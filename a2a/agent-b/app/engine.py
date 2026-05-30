"""Agent B engine: react to a ring intercept, compute, claim escrow.

On a `rail:ring` INTERCEPT (the speculative trigger), Agent B reads the scenario's
precomputed report, shows the compute label, waits computeMs, hashes the proof
fields, then calls completeTask GATED on the funding-tx receipt (retry once if the
task isn't funded on-chain yet). Verification itself stays mocked (P4).
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path

from aom_common.chain import (
    account_from_key,
    get_contract,
    hex32,
    load_env,
    make_web3,
    proof_hash,
)
from aom_common.event import AomEvent, Phase, Status
from aom_common.hub_client import HubClient
from aom_common.scenario import Scenario, active_scenario_id, load_scenario
from web3 import Web3

_ROOT = Path(__file__).resolve().parents[2]


class AgentB:
    def __init__(self, scenario: Scenario) -> None:
        self.scenario = scenario
        env = load_env()
        self.w3 = make_web3(env["MONAD_TESTNET_RPC"])
        self.contract = get_contract(self.w3, env["ESCROW_ADDRESS"])
        self.signer = account_from_key(env["AGENT_B_PRIVATE_KEY"])
        self.chain_id = int(env.get("MONAD_TESTNET_CHAIN_ID", "10143"))
        self.hub = HubClient(env.get("HUB_URL", "ws://localhost:8787"))
        self.report = self._load_report()
        # Two distinct dedup sets: intercepts seen (per intercepted taskId) vs winners
        # already completed (per resolved winner). In single mode winner == task, so a
        # shared set would make the completion step think it was already handled.
        self._seen_intercepts: set[str] = set()
        self._handled: set[str] = set()  # resolved winners that have been completed
        # Serialize completions so concurrent loser-intercepts don't double-send a
        # completeTask for the same race winner.
        self._complete_lock = asyncio.Lock()
        # Strong refs to in-flight handler tasks. asyncio.create_task only keeps a
        # weak reference — without this, a fire-and-forget handler can be garbage
        # collected mid-await and silently vanish (the PIPELINE-then-nothing stall).
        self._inflight: set["asyncio.Task[None]"] = set()

    def _load_report(self) -> dict[str, object]:
        path = _ROOT / "data" / self.scenario.id / "report.json"
        if path.is_file():
            return json.loads(path.read_text())
        # Fallback synthetic report from the scenario proof fields.
        return {f: f"{f}-value" for f in self.scenario.proof.fields}

    async def publish(self, event: AomEvent) -> None:
        await self.hub.publish(event)

    def _resolve_winner(self, task_id: bytes) -> bytes | None:
        """In race mode the contract only lets the resourceWinner complete. Map the
        intercepted task to the winning taskId for its resource. Single mode: identity.
        Returns None if a race winner can't be resolved (never complete a maybe-loser)."""
        try:
            task = self.contract.functions.getTask(task_id).call()
            # Task tuple: (funder, agentB, amount, taskCommit, resourceId, status)
            resource_id = bytes(task[4])
        except Exception:  # noqa: BLE001
            return task_id
        if resource_id == b"\x00" * 32:
            return task_id  # single mode
        for _ in range(16):
            try:
                winner = bytes(self.contract.functions.resourceWinner(resource_id).call())
            except Exception:  # noqa: BLE001
                winner = b"\x00" * 32
            if winner != b"\x00" * 32:
                return winner
            time.sleep(0.5)
        return None  # winner slot never resolved — do not complete a possible loser

    def _wait_for_funding(self, task_id: bytes, tries: int = 12) -> bool:
        """Gate: confirm the task is Funded on-chain before completeTask (Arch #3).
        Polls through the speculative→funded finality window."""
        for attempt in range(tries):
            try:
                task = self.contract.functions.getTask(task_id).call()
                # Task tuple: (funder, agentB, amount, taskCommit, resourceId, status)
                status = task[5]
                if status == 1:  # Funded
                    return True
                if status in (2, 3):  # already Completed/Refunded — nothing to do
                    return False
            except Exception:  # noqa: BLE001
                pass
            if attempt < tries - 1:
                time.sleep(0.5)
        return False

    def _complete_winner(self, winner: bytes, report_hash: bytes) -> tuple[bytes, str] | None:
        """Complete the resolved winner taskId (race) or the task itself (single),
        gated on the funding receipt with one retry (Arch #3)."""
        if not self._wait_for_funding(winner):
            print(f"[agent-b] task {winner.hex()[:10]} not funded yet — skipping completeTask")
            return None
        nonce = self.w3.eth.get_transaction_count(self.signer.address)
        tx = self.contract.functions.completeTask(winner, report_hash).build_transaction(
            {
                "from": self.signer.address,
                "nonce": nonce,
                "gas": 150_000,
                "gasPrice": self.w3.eth.gas_price,
                "chainId": self.chain_id,
            }
        )
        signed = self.signer.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return winner, tx_hash.hex()

    def _resolve_and_complete(self, task_id: bytes, report_hash: bytes) -> tuple[bytes, str] | None:
        """Blocking: resolve the race winner, then completeTask. Runs in a worker
        thread. Returns (winner, txHash) or None (unresolved/already-settled/skipped)."""
        winner = self._resolve_winner(task_id)
        if winner is None:
            return None
        winner_hex = hex32(winner)
        if winner_hex in self._handled:
            return None  # a sibling intercept already settled this resource's winner
        self._handled.add(winner_hex)
        return self._complete_winner(winner, report_hash)

    async def handle_intercept(self, task_id_hex: str) -> None:
        """Fired by a rail:ring intercept. Idempotent per intercepted task."""
        if task_id_hex in self._seen_intercepts:
            return
        self._seen_intercepts.add(task_id_hex)

        # Compute the proof hash from the precomputed report.
        rhash = proof_hash(self.scenario.proof.fields, self.report)
        await self.publish(
            AomEvent(
                phase=Phase.PIPELINE,
                taskId=task_id_hex,
                status=Status.COMPUTING,
                reportHash=hex32(rhash),
                msg=self.scenario.agentB.label,
            )
        )
        # Mocked compute delay — also covers the speculative→funded finality window.
        await asyncio.sleep(self.scenario.agentB.computeMs / 1000.0)

        task_id = bytes.fromhex(task_id_hex[2:])
        async with self._complete_lock:
            # web3 calls are blocking HTTP — run the resolve+complete chain in a worker
            # thread (a sync call on the event loop freezes the websocket recv) with a
            # hard timeout so a slow RPC can never hang the demo.
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(self._resolve_and_complete, task_id, rhash),
                    timeout=30,
                )
            except asyncio.TimeoutError:
                print(f"[agent-b] completeTask timed out for {task_id_hex[:10]}")
                result = None
        if result is None:
            await self.publish(
                AomEvent(
                    phase=Phase.PIPELINE,
                    taskId=task_id_hex,
                    status=Status.COMPUTING,
                    reportHash=hex32(rhash),
                    msg="task not finalized, retrying",
                )
            )
            return
        winner, tx_hash = result
        winner_hex = hex32(winner)
        # Key idempotency on the actual completed task too, so other loser-intercepts
        # for the same resource don't fire a second completeTask.
        self._handled.add(winner_hex)
        await self.publish(
            AomEvent(
                phase=Phase.SETTLEMENT,
                taskId=winner_hex,
                status=Status.SETTLED,
                reportHash=hex32(rhash),
                txHash=_norm_hash(tx_hash),
                msg=f"{self.scenario.amountMon} MON released to {self.scenario.story.agentB}",
            )
        )

    def _on_task_done(self, task: "asyncio.Task[None]") -> None:
        # Fire-and-forget intercept handlers must surface exceptions; a swallowed
        # error here looks like a silent stall at PIPELINE.
        self._inflight.discard(task)
        exc = task.exception() if not task.cancelled() else None
        if exc is not None:
            print(f"[agent-b] intercept handler failed: {exc!r}")

    async def run(self) -> None:
        await self.hub.connect()
        print(f"[agent-b] scenario={self.scenario.id} signer={self.signer.address}")
        async for msg in self.hub.messages():
            if msg.get("phase") == "INTERCEPT" and msg.get("rail") == "ring":
                task_id = msg.get("taskId")
                if isinstance(task_id, str):
                    t = asyncio.create_task(self.handle_intercept(task_id))
                    self._inflight.add(t)  # strong ref so it can't be GC'd mid-await
                    t.add_done_callback(self._on_task_done)


def _norm_hash(h: str) -> str:
    h = h.lower()
    return h if h.startswith("0x") else "0x" + h


def build_agent() -> AgentB:
    return AgentB(load_scenario(active_scenario_id()))


def main() -> None:
    asyncio.run(build_agent().run())


if __name__ == "__main__":
    main()
