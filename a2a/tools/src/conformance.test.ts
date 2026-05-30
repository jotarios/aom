// Schema-conformance test (TS side). Asserts:
//  - every example in schema.json validates against the TS validator
//  - phase + rail enums are exhaustive vs schema.json
//  - makeEvent output validates
//  - a malformed event is rejected

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateEvent, makeEvent, PHASES, RAILS, STATUSES } from "@aom/shared";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "..", "..", "schema", "schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
  examples: unknown[];
  properties: {
    phase: { enum: string[] };
    rail: { enum: (string | null)[] };
    status: { enum: string[] };
  };
};

test("every schema example validates", () => {
  assert.ok(Array.isArray(schema.examples) && schema.examples.length > 0, "schema has examples");
  for (const ex of schema.examples) {
    const r = validateEvent(ex);
    assert.ok(r.ok, `example failed: ${r.ok ? "" : r.error} — ${JSON.stringify(ex)}`);
  }
});

test("phase enum is exhaustive vs schema", () => {
  assert.deepEqual([...PHASES].sort(), [...schema.properties.phase.enum].sort());
});

test("rail enum is exhaustive vs schema (excluding null)", () => {
  const schemaRails = schema.properties.rail.enum.filter((r): r is string => r !== null).sort();
  assert.deepEqual([...RAILS].sort(), schemaRails);
});

test("status enum is exhaustive vs schema", () => {
  assert.deepEqual([...STATUSES].sort(), [...schema.properties.status.enum].sort());
});

test("makeEvent fills nullable fields and validates", () => {
  const e = makeEvent({
    phase: "INTENT",
    taskId: "0x" + "0".repeat(64),
    status: "pending",
    msg: "hi",
  });
  const r = validateEvent(e);
  assert.ok(r.ok);
  assert.equal(e.rail, null);
  assert.equal(e.latencyMs, null);
});

test("malformed event is rejected", () => {
  const r = validateEvent({ phase: "NOPE", taskId: "0x1", status: "pending", msg: "x" });
  assert.ok(!r.ok);
});

test("bad taskId is rejected", () => {
  const r = validateEvent(makeEvent({ phase: "INTENT", taskId: "not-hex", status: "pending", msg: "x" }));
  assert.ok(!r.ok);
});
