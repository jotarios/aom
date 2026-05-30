import type { AomEvent, Phase, Status } from "@aom/shared";

export interface LogLine {
  id: string;
  ts: number;
  tag: string;
  msg: string;
  level: "info" | "ok" | "error";
  txHash: string | null;
}

export interface RailObs {
  ring: number | null; // latencyMs
  rpc: number | null;
}

export interface Task {
  taskId: string;
  walletId: string | null;
  resourceId: string | null;
  status: Status;
  phase: Phase;
  reportHash: string | null;
  rails: RailObs;
  blockNumber: number | null;
  lastUpdate: number;
  // When each phase was first observed for this task — drives the timeline checkmarks.
  phaseSeenAt: Partial<Record<Phase, number>>;
}

export interface LedgerEntry {
  taskId: string;
  kind: "settled" | "reverted";
  msg: string;
  txHash: string | null;
  blockNumber: number | null;
  latencyMs: number | null;
  ts: number;
}

export interface ConsoleState {
  agentALog: LogLine[]; // left rail
  agentBLog: LogLine[]; // right rail
  tasks: Record<string, Task>;
  taskOrder: string[];
  ledger: LedgerEntry[];
  latestBlock: number | null;
  // the most recent intercept that should fire the seam pulse
  lastSeam: { taskId: string; at: number } | null;
  // identities of events already applied, so a duplicate delivery (e.g. a second
  // hub subscription under React StrictMode double-mount) is ignored.
  seen: Set<string>;
}

export const initialState: ConsoleState = {
  agentALog: [],
  agentBLog: [],
  tasks: {},
  taskOrder: [],
  ledger: [],
  latestBlock: null,
  lastSeam: null,
  seen: new Set<string>(),
};

function eventKey(e: AomEvent): string {
  return `${e.phase}|${e.taskId}|${e.rail ?? ""}|${e.ts ?? ""}|${e.msg}`;
}

let seq = 0;
function lineId(): string {
  seq += 1;
  return `l${seq}`;
}

const AGENT_A_PHASES: Phase[] = ["INTENT", "ESCROW_LOCK", "REVERTED"];

export function reduce(state: ConsoleState, e: AomEvent): ConsoleState {
  const key = eventKey(e);
  if (state.seen.has(key)) return state; // duplicate delivery — ignore

  const now = e.ts ?? Date.now();
  const seen = new Set(state.seen);
  seen.add(key);
  const next: ConsoleState = { ...state, seen, tasks: { ...state.tasks } };

  // Upsert the task
  const prev = state.tasks[e.taskId];
  const task: Task = prev
    ? { ...prev, phaseSeenAt: { ...prev.phaseSeenAt } }
    : {
        taskId: e.taskId,
        walletId: e.walletId,
        resourceId: e.resourceId,
        status: e.status,
        phase: e.phase,
        reportHash: e.reportHash,
        rails: { ring: null, rpc: null },
        blockNumber: e.blockNumber,
        lastUpdate: now,
        phaseSeenAt: {},
      };
  task.status = e.status;
  task.phase = e.phase;
  task.lastUpdate = now;
  if (task.phaseSeenAt[e.phase] == null) task.phaseSeenAt[e.phase] = now;
  if (e.walletId) task.walletId = e.walletId;
  if (e.resourceId) task.resourceId = e.resourceId;
  if (e.reportHash) task.reportHash = e.reportHash;
  if (e.blockNumber != null) task.blockNumber = e.blockNumber;

  if (e.phase === "INTERCEPT" && e.rail && e.latencyMs != null) {
    task.rails = { ...task.rails, [e.rail]: e.latencyMs };
    if (e.rail === "ring") next.lastSeam = { taskId: e.taskId, at: now };
  }

  next.tasks[e.taskId] = task;
  if (!state.taskOrder.includes(e.taskId)) {
    next.taskOrder = [...state.taskOrder, e.taskId];
  }

  // Log routing: A-side phases → left, compute/settlement → right
  const level: LogLine["level"] = e.status === "settled" ? "ok" : e.status === "reverted" ? "error" : "info";
  const line: LogLine = { id: lineId(), ts: now, tag: e.phase, msg: e.msg, level, txHash: e.txHash };
  if (AGENT_A_PHASES.includes(e.phase)) {
    next.agentALog = cap([...state.agentALog, line]);
  } else if (e.phase === "PIPELINE" || e.phase === "INTERCEPT" || e.phase === "SETTLEMENT") {
    next.agentBLog = cap([...state.agentBLog, line]);
    // settlement also shows on A's side (it receives the verified result)
    if (e.phase === "SETTLEMENT") next.agentALog = cap([...state.agentALog, line]);
  }

  // Ledger
  if (e.phase === "SETTLEMENT") {
    next.ledger = capLedger([
      ...state.ledger,
      { taskId: e.taskId, kind: "settled", msg: e.msg, txHash: e.txHash, blockNumber: e.blockNumber, latencyMs: task.rails.ring, ts: now },
    ]);
  } else if (e.phase === "REVERTED") {
    next.ledger = capLedger([
      ...state.ledger,
      { taskId: e.taskId, kind: "reverted", msg: e.msg, txHash: e.txHash, blockNumber: e.blockNumber, latencyMs: null, ts: now },
    ]);
  }

  if (e.blockNumber != null && (state.latestBlock == null || e.blockNumber > state.latestBlock)) {
    next.latestBlock = e.blockNumber;
  }

  // Bound the dedup set so a long-running demo doesn't grow it without limit.
  if (seen.size > 500) {
    next.seen = new Set([...seen].slice(seen.size - 500));
  }

  return next;
}

function cap(lines: LogLine[]): LogLine[] {
  return lines.length > 80 ? lines.slice(lines.length - 80) : lines;
}
function capLedger(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.length > 40 ? entries.slice(entries.length - 40) : entries;
}

/** Watchdog (1D.7): tasks stuck in computing past `ms` are flagged retrying. */
export function stalledTasks(state: ConsoleState, ms: number, now: number): Task[] {
  return Object.values(state.tasks).filter(
    (t) => t.status === "computing" && now - t.lastUpdate > ms,
  );
}
