// Mock event emitter — publishes a full happy-path (or race) sequence to the hub
// on a timer. Lets the UI and agents be built before any real component exists.

import WebSocket from "ws";
import { makeEvent, type AomEvent, type Scenario } from "@aom/shared";
import { loadScenario, activeScenarioId } from "@aom/shared/node";

const HUB_URL = process.env.HUB_URL ?? "ws://localhost:8787";

function taskIdFor(n: number): string {
  return "0x" + n.toString(16).padStart(64, "0");
}

function randHash(seed: number): string {
  // deterministic-ish 64 hex from a seed; not cryptographic, mock only.
  let h = (seed * 2654435761) >>> 0;
  let out = "";
  for (let i = 0; i < 64; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out += (h & 0xf).toString(16);
  }
  return "0x" + out;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function runSingle(ws: WebSocket, scenario: Scenario, iteration: number, block: number): Promise<number> {
  const taskId = taskIdFor(iteration + 1);
  const txLock = randHash(iteration + 100);
  const reportHash = randHash(iteration + 200);
  const txComplete = randHash(iteration + 300);

  const send = (e: AomEvent) => ws.send(JSON.stringify({ ...e, ts: Date.now() }));

  send(makeEvent({ phase: "INTENT", taskId, status: "pending", msg: `${scenario.story.agentA} opens task ${iteration + 1}` }));
  await sleep(300);
  send(makeEvent({ phase: "ESCROW_LOCK", taskId, status: "pending", txHash: txLock, blockNumber: block, walletId: "agent-a-0", msg: `lockFunds(${taskId.slice(0, 8)}…) → ${scenario.amountMon} MON` }));
  await sleep(150);
  // both rails observe the intercept; ring fast, rpc slow
  send(makeEvent({ phase: "INTERCEPT", taskId, status: "computing", rail: "ring", latencyMs: 0.4 + Math.random() * 0.8, blockNumber: block, msg: "ring buffer intercept" }));
  send(makeEvent({ phase: "INTERCEPT", taskId, status: "computing", rail: "rpc", latencyMs: 280 + Math.random() * 220, blockNumber: block, msg: "eth_getLogs poll matched" }));
  await sleep(120);
  send(makeEvent({ phase: "PIPELINE", taskId, status: "computing", reportHash, msg: scenario.agentB.label }));
  await sleep(scenario.agentB.computeMs);
  send(makeEvent({ phase: "SETTLEMENT", taskId, status: "settled", reportHash, txHash: txComplete, blockNumber: block + 1, msg: `${scenario.amountMon} MON released to ${scenario.story.agentB}` }));
  return block + 2;
}

async function runRace(ws: WebSocket, scenario: Scenario, round: number, block: number): Promise<number> {
  const resourceId = scenario.resourceId ?? "resource-0";
  const send = (e: AomEvent) => ws.send(JSON.stringify({ ...e, ts: Date.now() }));
  const base = round * 100;
  const taskIds = Array.from({ length: scenario.wallets }, (_, i) => taskIdFor(base + i + 1));
  const winner = Math.floor(Math.random() * scenario.wallets);

  // all wallets lock near-simultaneously
  taskIds.forEach((taskId, i) => {
    send(makeEvent({ phase: "ESCROW_LOCK", taskId, status: "pending", txHash: randHash(base + i + 10), blockNumber: block, walletId: `bidder-${i}`, resourceId, msg: `lockFunds(${taskId.slice(0, 8)}…) → ${scenario.amountMon} MON` }));
  });
  await sleep(120);
  const winId = taskIds[winner]!;
  send(makeEvent({ phase: "INTERCEPT", taskId: winId, status: "computing", rail: "ring", latencyMs: 0.5 + Math.random() * 0.8, blockNumber: block, resourceId, msg: "ring buffer intercept — first funder" }));
  send(makeEvent({ phase: "INTERCEPT", taskId: winId, status: "computing", rail: "rpc", latencyMs: 290 + Math.random() * 200, blockNumber: block, resourceId, msg: "eth_getLogs poll matched" }));
  await sleep(120);
  const reportHash = randHash(base + 50);
  send(makeEvent({ phase: "PIPELINE", taskId: winId, status: "computing", reportHash, resourceId, msg: scenario.agentB.label }));
  await sleep(scenario.agentB.computeMs);
  send(makeEvent({ phase: "SETTLEMENT", taskId: winId, status: "settled", reportHash, txHash: randHash(base + 60), blockNumber: block + 1, walletId: `bidder-${winner}`, resourceId, msg: `${scenario.amountMon} MON released — bidder-${winner} won ${resourceId}` }));
  // losers refund
  taskIds.forEach((taskId, i) => {
    if (i === winner) return;
    send(makeEvent({ phase: "REVERTED", taskId, status: "reverted", txHash: randHash(base + 70 + i), blockNumber: block + 1, walletId: `bidder-${i}`, resourceId, msg: `refund — bidder-${i} lost the race, funds returned` }));
  });
  return block + 2;
}

async function main(): Promise<void> {
  const scenario = loadScenario(activeScenarioId());
  console.log(`[mock] scenario=${scenario.id} mode=${scenario.mode} → ${HUB_URL}`);
  const ws = new WebSocket(HUB_URL);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  console.log("[mock] connected to hub");

  let block = 1234567;
  for (let i = 0; i < scenario.run.count; i++) {
    block = scenario.mode === "race" ? await runRace(ws, scenario, i, block) : await runSingle(ws, scenario, i, block);
    if (i < scenario.run.count - 1) await sleep(scenario.run.spacingMs);
  }
  console.log("[mock] sequence complete");
  await sleep(500);
  ws.close();
}

main().catch((e) => {
  console.error("[mock] error:", e);
  process.exit(1);
});
