// Mirror of schema/schema.json — the event-stream contract.
// Keep field names/enums in lockstep with schema.json and the pydantic / Rust mirrors.

export const PHASES = [
  "INTENT",
  "ESCROW_LOCK",
  "INTERCEPT",
  "PIPELINE",
  "SETTLEMENT",
  "REVERTED",
] as const;
export type Phase = (typeof PHASES)[number];

export const RAILS = ["ring", "rpc"] as const;
export type Rail = (typeof RAILS)[number];

export const STATUSES = ["pending", "computing", "settled", "reverted"] as const;
export type Status = (typeof STATUSES)[number];

export interface AomEvent {
  phase: Phase;
  taskId: string;
  rail: Rail | null;
  latencyMs: number | null;
  status: Status;
  reportHash: string | null;
  txHash: string | null;
  msg: string;
  walletId: string | null;
  resourceId: string | null;
  blockNumber: number | null;
  ts: number | null;
}

const HEX64 = /^0x[0-9a-f]{64}$/;

function isHex64OrNull(v: unknown): v is string | null {
  return v === null || (typeof v === "string" && HEX64.test(v));
}

/** Validate an arbitrary parsed JSON value against the event contract. */
export function validateEvent(value: unknown): { ok: true; event: AomEvent } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "event is not an object" };
  }
  const v = value as Record<string, unknown>;

  if (typeof v.phase !== "string" || !(PHASES as readonly string[]).includes(v.phase)) {
    return { ok: false, error: `invalid phase: ${String(v.phase)}` };
  }
  if (typeof v.taskId !== "string" || !HEX64.test(v.taskId)) {
    return { ok: false, error: `invalid taskId: ${String(v.taskId)}` };
  }
  if (!(v.rail === null || v.rail === undefined || (RAILS as readonly string[]).includes(v.rail as string))) {
    return { ok: false, error: `invalid rail: ${String(v.rail)}` };
  }
  if (!(v.latencyMs === null || v.latencyMs === undefined || typeof v.latencyMs === "number")) {
    return { ok: false, error: "invalid latencyMs" };
  }
  if (typeof v.status !== "string" || !(STATUSES as readonly string[]).includes(v.status)) {
    return { ok: false, error: `invalid status: ${String(v.status)}` };
  }
  if (!isHex64OrNull(v.reportHash ?? null)) {
    return { ok: false, error: `invalid reportHash: ${String(v.reportHash)}` };
  }
  if (!isHex64OrNull(v.txHash ?? null)) {
    return { ok: false, error: `invalid txHash: ${String(v.txHash)}` };
  }
  if (typeof v.msg !== "string") {
    return { ok: false, error: "invalid msg" };
  }
  if (!(v.walletId === null || v.walletId === undefined || typeof v.walletId === "string")) {
    return { ok: false, error: "invalid walletId" };
  }
  if (!(v.resourceId === null || v.resourceId === undefined || typeof v.resourceId === "string")) {
    return { ok: false, error: "invalid resourceId" };
  }
  if (!(v.blockNumber === null || v.blockNumber === undefined || (typeof v.blockNumber === "number" && Number.isInteger(v.blockNumber)))) {
    return { ok: false, error: "invalid blockNumber" };
  }
  if (!(v.ts === null || v.ts === undefined || typeof v.ts === "number")) {
    return { ok: false, error: "invalid ts" };
  }

  const event: AomEvent = {
    phase: v.phase as Phase,
    taskId: v.taskId,
    rail: (v.rail ?? null) as Rail | null,
    latencyMs: (v.latencyMs ?? null) as number | null,
    status: v.status as Status,
    reportHash: (v.reportHash ?? null) as string | null,
    txHash: (v.txHash ?? null) as string | null,
    msg: v.msg,
    walletId: (v.walletId ?? null) as string | null,
    resourceId: (v.resourceId ?? null) as string | null,
    blockNumber: (v.blockNumber ?? null) as number | null,
    ts: (v.ts ?? null) as number | null,
  };
  return { ok: true, event };
}

/** Build a fully-populated event, filling nullable fields with null. */
export function makeEvent(
  partial: Pick<AomEvent, "phase" | "taskId" | "status" | "msg"> & Partial<AomEvent>,
): AomEvent {
  return {
    rail: null,
    latencyMs: null,
    reportHash: null,
    txHash: null,
    walletId: null,
    resourceId: null,
    blockNumber: null,
    ts: null,
    ...partial,
  };
}
