// Hub smoke test: 3 publishers + 1 subscriber receive all; the relay survives a
// producer disconnect without wedging. (1B.2)

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import type { WebSocketServer } from "ws";
import { makeEvent, type AomEvent } from "@aom/shared";
import { startHub } from "./hub.js";

const PORT = 8799;
const WS_URL = `ws://localhost:${PORT}`;
let hub: WebSocketServer;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function open(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

before(async () => {
  hub = startHub(PORT);
  await new Promise<void>((resolve) => hub.once("listening", () => resolve()));
});

after(() => {
  hub.close();
});

test("3 publishers reach 1 subscriber", async () => {
  const sub = await open(WS_URL);
  const received: AomEvent[] = [];
  sub.on("message", (d) => received.push(JSON.parse(d.toString())));
  await sleep(100);

  const pubs = await Promise.all([open(WS_URL), open(WS_URL), open(WS_URL)]);
  pubs.forEach((p, i) => {
    p.send(JSON.stringify(makeEvent({ phase: "INTENT", taskId: "0x" + String(i + 1).padStart(64, "0"), status: "pending", msg: `from pub ${i}` })));
  });
  await sleep(300);

  assert.equal(received.length, 3, `subscriber should get all 3, got ${received.length}`);
  pubs.forEach((p) => p.close());
  sub.close();
});

test("relay survives a producer disconnect", async () => {
  const sub = await open(WS_URL);
  const received: AomEvent[] = [];
  sub.on("message", (d) => received.push(JSON.parse(d.toString())));
  await sleep(100);

  const doomed = await open(WS_URL);
  doomed.send(JSON.stringify(makeEvent({ phase: "INTENT", taskId: "0x" + "a".repeat(64), status: "pending", msg: "before drop" })));
  await sleep(150);
  doomed.terminate(); // hard drop
  await sleep(150);

  const live = await open(WS_URL);
  live.send(JSON.stringify(makeEvent({ phase: "SETTLEMENT", taskId: "0x" + "b".repeat(64), status: "settled", msg: "after drop" })));
  await sleep(200);

  assert.ok(received.some((e) => e.msg === "after drop"), "hub still relays after a producer dropped");
  live.close();
  sub.close();
});
