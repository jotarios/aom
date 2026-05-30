"""Agent A — Macro Buyer.

Reads the active scenario, fires lockFunds (1 in single mode, N near-simultaneous
in race mode), and drives the autonomous loop. The manual UI button reaches here
via a `trigger` control message on the hub — loop and button both land on
trigger_audit(), guarded single-flight. In race mode, losing bids are auto-refunded.
"""

from __future__ import annotations

import asyncio
import os
import time

from aom_common.chain import (
    account_from_key,
    get_contract,
    hex32,
    load_env,
    make_web3,
    task_commit,
    to_task_id,
)
from aom_common.event import AomEvent, Phase, Status
from aom_common.hub_client import HubClient
from aom_common.scenario import Scenario, ScenarioMode, active_scenario_id, load_scenario
from web3 import Web3


class AgentA:
    def __init__(self, scenario: Scenario) -> None:
        self.scenario = scenario
        env = load_env()
        self.w3 = make_web3(env["MONAD_TESTNET_RPC"])
        self.escrow_addr = env["ESCROW_ADDRESS"]
        self.contract = get_contract(self.w3, self.escrow_addr)
        self.amount_wei = Web3.to_wei(scenario.amountMon, "ether")
        self.hub = HubClient(env.get("HUB_URL", "ws://localhost:8787"))

        # Agent A signs locks. Race mode uses derived wallets from the same key
        # space for demo simplicity; each bidder is a distinct nonce-tracked signer.
        self.signers = self._make_signers(env)
        self.agent_b_addr = Web3.to_checksum_address(env["AGENT_B_ADDRESS"])

        self._inflight = asyncio.Lock()
        self._round = 0
        # Local nonce tracking per signer address. Race mode fires several txs from the
        # same wallet back-to-back; reading the pending nonce each time returns the same
        # value before the first lands → "higher priority" collisions. Bump locally.
        self._nonces: dict[str, int] = {}

    def _next_nonce(self, address: str) -> int:
        chain_n = self.w3.eth.get_transaction_count(address, "pending")
        local_n = self._nonces.get(address, 0)
        n = max(chain_n, local_n)
        self._nonces[address] = n + 1
        return n

    def _make_signers(self, env: dict[str, str]) -> list[object]:
        keys = [env["AGENT_A_PRIVATE_KEY"]]
        # Extra race wallets, if provided, e.g. AGENT_A_PRIVATE_KEY_1..N
        for i in range(1, self.scenario.wallets):
            k = env.get(f"AGENT_A_PRIVATE_KEY_{i}")
            if k:
                keys.append(k)
        # If not enough distinct keys, reuse the primary (locks still differ by taskId;
        # nonce is single-flight serialized so this is safe for the demo).
        while len(keys) < self.scenario.wallets:
            keys.append(env["AGENT_A_PRIVATE_KEY"])
        return [account_from_key(k) for k in keys[: self.scenario.wallets]]

    async def publish(self, event: AomEvent) -> None:
        await self.hub.publish(event)

    def _send_lock(self, signer: object, task_id: bytes, resource_id: bytes | None) -> str:
        acct = signer
        commit = task_commit(f"{self.scenario.id}:{task_id.hex()}")
        nonce = self._next_nonce(acct.address)  # type: ignore[attr-defined]
        if resource_id is None:
            fn = self.contract.functions.lockFunds(task_id, self.agent_b_addr, commit)
        else:
            fn = self.contract.functions.lockFunds(task_id, self.agent_b_addr, commit, resource_id)
        tx = fn.build_transaction(
            {
                "from": acct.address,  # type: ignore[attr-defined]
                "value": self.amount_wei,
                "nonce": nonce,
                "gas": 250_000,
                "gasPrice": self.w3.eth.gas_price,
                "chainId": int(os.environ.get("MONAD_TESTNET_CHAIN_ID", "10143")),
            }
        )
        # Pre-flight: a wallet that can't cover value + gas reverts the lock, which
        # would otherwise look like success and produce a task that never settles.
        bal = self.w3.eth.get_balance(acct.address)  # type: ignore[attr-defined]
        if bal < self.amount_wei + 250_000 * tx["gasPrice"]:
            raise RuntimeError(
                f"{acct.address} balance too low to lock "  # type: ignore[attr-defined]
                f"({Web3.from_wei(bal, 'ether')} MON) — fund it via the faucet"
            )
        signed = acct.sign_transaction(tx)  # type: ignore[attr-defined]
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
        if receipt.get("status") != 1:
            raise RuntimeError(f"lockFunds reverted on-chain (tx {tx_hash.hex()})")
        return tx_hash.hex()

    def _send_refund(self, signer: object, task_id: bytes) -> str:
        acct = signer
        nonce = self._next_nonce(acct.address)  # type: ignore[attr-defined]
        tx = self.contract.functions.refund(task_id).build_transaction(
            {
                "from": acct.address,  # type: ignore[attr-defined]
                "nonce": nonce,
                "gas": 120_000,
                "gasPrice": self.w3.eth.gas_price,
                "chainId": int(os.environ.get("MONAD_TESTNET_CHAIN_ID", "10143")),
            }
        )
        signed = acct.sign_transaction(tx)  # type: ignore[attr-defined]
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return tx_hash.hex()

    async def trigger_audit(self) -> None:
        """Single entry point for both the loop and the manual button. Single-flight."""
        if self._inflight.locked():
            print("[agent-a] trigger ignored — task already in flight")
            return
        async with self._inflight:
            if self.scenario.mode == ScenarioMode.RACE.value:
                await self._run_race()
            else:
                await self._run_single()
            self._round += 1

    async def _run_single(self) -> None:
        story = self.scenario.story
        task_id = to_task_id(f"{self.scenario.id}:single:{self._round}:{time.time()}")
        await self.publish(
            AomEvent(phase=Phase.INTENT, taskId=hex32(task_id), status=Status.PENDING, walletId="agent-a-0", msg=f"{story.agentA} opens a task")
        )
        loop = asyncio.get_running_loop()
        tx_hash = await loop.run_in_executor(None, self._send_lock, self.signers[0], task_id, None)
        await self.publish(
            AomEvent(
                phase=Phase.ESCROW_LOCK,
                taskId=hex32(task_id),
                status=Status.PENDING,
                txHash=_norm_hash(tx_hash),
                walletId="agent-a-0",
                msg=f"lockFunds({hex32(task_id)[:10]}…) → {self.scenario.amountMon} MON",
            )
        )

    async def _run_race(self) -> None:
        story = self.scenario.story
        base = f"{self.scenario.id}:race:{self._round}:{time.time()}"
        # The on-chain resourceId must be UNIQUE per round — the contract stores the
        # slot winner permanently per resourceId, so a fixed id would make every run
        # after the first a no-win. The scenario's resourceId stays the display label.
        resource_id = to_task_id(f"resource:{base}")
        task_ids = [to_task_id(f"{base}:{i}") for i in range(self.scenario.wallets)]

        await self.publish(
            AomEvent(
                phase=Phase.INTENT,
                taskId=hex32(task_ids[0]),
                status=Status.PENDING,
                resourceId=self.scenario.resourceId,
                msg=f"{self.scenario.wallets} {story.agentA}s race for {self.scenario.resourceId}",
            )
        )

        loop = asyncio.get_running_loop()
        # Near-simultaneous locks. Single-flight at the audit level; here we serialize
        # sends per-signer to avoid nonce collisions but fire them back-to-back.
        for i, task_id in enumerate(task_ids):
            tx_hash = await loop.run_in_executor(None, self._send_lock, self.signers[i], task_id, resource_id)
            await self.publish(
                AomEvent(
                    phase=Phase.ESCROW_LOCK,
                    taskId=hex32(task_id),
                    status=Status.PENDING,
                    txHash=_norm_hash(tx_hash),
                    walletId=f"bidder-{i}",
                    resourceId=self.scenario.resourceId,
                    msg=f"bidder-{i} lockFunds({hex32(task_id)[:10]}…) → {self.scenario.amountMon} MON",
                )
            )

        # Resolve the on-chain winner, then auto-refund the losing bids. The executor
        # returns refund results; we publish their events back on the event loop.
        refunds = await loop.run_in_executor(None, self._refund_losers, task_ids, resource_id)
        for i, task_id, tx_hash in refunds:
            await self.publish(
                AomEvent(
                    phase=Phase.REVERTED,
                    taskId=hex32(task_id),
                    status=Status.REVERTED,
                    txHash=_norm_hash(tx_hash),
                    walletId=f"bidder-{i}",
                    resourceId=self.scenario.resourceId,
                    msg=f"refund — bidder-{i} lost the race, funds returned",
                )
            )

    def _refund_losers(self, task_ids: list[bytes], resource_id: bytes) -> list[tuple[int, bytes, str]]:
        results: list[tuple[int, bytes, str]] = []
        # Poll for the winner slot to be written.
        winner = b"\x00" * 32
        for _ in range(16):
            try:
                winner = bytes(self.contract.functions.resourceWinner(resource_id).call())
            except Exception:  # noqa: BLE001
                winner = b"\x00" * 32
            if winner != b"\x00" * 32:
                break
            time.sleep(0.5)
        if winner == b"\x00" * 32:
            print("[agent-a] winner slot never resolved — skipping refunds")
            return results

        # Wait for Agent B to settle the winner (status Completed) before refunding the
        # losers, so we never race the winner's completeTask. Bounded wait.
        for _ in range(30):
            try:
                wtask = self.contract.functions.getTask(winner).call()
                if wtask[5] == 2:  # Completed
                    break
            except Exception:  # noqa: BLE001
                pass
            time.sleep(0.5)

        for i, task_id in enumerate(task_ids):
            if bytes(task_id) == winner:
                continue  # never refund the winner
            try:
                tx_hash = self._send_refund(self.signers[i], task_id)
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=20)
                if receipt.get("status") == 1:
                    results.append((i, task_id, tx_hash))
                else:
                    print(f"[agent-a] refund tx for bidder-{i} reverted")
            except Exception as exc:  # noqa: BLE001
                print(f"[agent-a] refund failed for bidder-{i}: {exc}")
        return results

    async def _autonomous_loop(self) -> None:
        for _ in range(self.scenario.run.count):
            await self.trigger_audit()
            await asyncio.sleep(self.scenario.run.spacingMs / 1000.0)

    async def _listen_triggers(self) -> None:
        async for msg in self.hub.messages():
            if msg.get("type") == "trigger":
                print("[agent-a] manual trigger received")
                await self.trigger_audit()

    async def run(self) -> None:
        await self.hub.connect()
        print(f"[agent-a] scenario={self.scenario.id} mode={self.scenario.mode} escrow={self.escrow_addr}")
        await asyncio.gather(self._autonomous_loop(), self._listen_triggers())


def _norm_hash(h: str) -> str:
    h = h.lower()
    return h if h.startswith("0x") else "0x" + h


def main() -> None:
    scenario = load_scenario(active_scenario_id())
    asyncio.run(AgentA(scenario).run())


if __name__ == "__main__":
    main()
