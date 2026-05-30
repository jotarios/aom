// E2E tests over the hub + mock emitter (deterministic, no live chain).
//  2.2  — single happy path (SCENARIO=toll): full phase sequence, ring beats rpc.
//  2.2b — race mode (SCENARIO=concert): N locks, 1 settle, N-1 reverts (cascade).
// The live-chain integrated spine is proven separately (see README run steps).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";
import type { AomEvent } from "@aom/shared";

const PORT = 8801;
const WS_URL = `ws://localhost:${PORT}`;
const toolsDir = dirname(dirname(fileURLToPath(import.meta.url)));
const hubDir = resolvePath(toolsDir, "..", "hub");
let hub: ChildProcess;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function open(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function runMock(scenario: string): ChildProcess {
  return spawn(process.execPath, ["--import", "tsx", join("src", "mock-emitter.ts")], {
    cwd: toolsDir,
    env: { ...process.env, HUB_URL: WS_URL, SCENARIO: scenario },
    stdio: "ignore",
  });
}

async function collect(scenario: string, ms: number): Promise<AomEvent[]> {
  const sub = await open(WS_URL);
  const events: AomEvent[] = [];
  sub.on("message", (d) => events.push(JSON.parse(d.toString())));
  await sleep(150);
  const mock = runMock(scenario);
  await sleep(ms);
  mock.kill("SIGTERM");
  sub.close();
  return events;
}

before(async () => {
  hub = spawn(process.execPath, ["--import", "tsx", join("src", "hub.ts")], {
    cwd: hubDir,
    env: { ...process.env, HUB_PORT: String(PORT) },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      const probe = await open(WS_URL);
      probe.close();
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error("hub did not start");
});

after(() => hub.kill("SIGINT"));

test("2.2 single happy path: full sequence, ring beats rpc", async () => {
  const events = await collect("toll", 4000);
  const phases = events.map((e) => e.phase);
  for (const p of ["INTENT", "ESCROW_LOCK", "INTERCEPT", "PIPELINE", "SETTLEMENT"]) {
    assert.ok(phases.includes(p as AomEvent["phase"]), `missing phase ${p}`);
  }
  const ring = events.find((e) => e.phase === "INTERCEPT" && e.rail === "ring");
  const rpc = events.find((e) => e.phase === "INTERCEPT" && e.rail === "rpc");
  assert.ok(ring && rpc, "both rails observed");
  assert.ok(ring!.latencyMs! < rpc!.latencyMs!, `ring (${ring!.latencyMs}) should beat rpc (${rpc!.latencyMs})`);

  const settle = events.find((e) => e.phase === "SETTLEMENT");
  assert.equal(settle?.status, "settled");
});

test("2.2b race mode: N locks, 1 settle, N-1 reverts", async () => {
  const events = await collect("concert", 5000);
  // First race round: 3 wallets lock the same resource.
  const locks = events.filter((e) => e.phase === "ESCROW_LOCK" && e.resourceId === "ticket-42");
  const settles = events.filter((e) => e.phase === "SETTLEMENT");
  const reverts = events.filter((e) => e.phase === "REVERTED");

  assert.ok(locks.length >= 3, `expected >=3 locks, got ${locks.length}`);
  assert.ok(settles.length >= 1, "at least one settlement");
  assert.ok(reverts.length >= 2, `expected >=2 reverts (cascade), got ${reverts.length}`);
  // Reverts carry a losing bidder id.
  assert.ok(reverts.every((r) => r.walletId?.startsWith("bidder-")), "reverts name the losing bidder");
});
