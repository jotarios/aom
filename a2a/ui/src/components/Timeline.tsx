import type { Phase } from "@aom/shared";
import type { Task } from "../state";
import "./Timeline.css";

// The agent flow as a shared timeline: one row per phase, Agent A's action on the
// left, Agent B's on the right, a connector + checkmark down the middle that fills
// in as each phase completes (mentor feedback, Option 1).

interface Step {
  phase: Phase;
  num: string;
  side: "a" | "b";
  label: string;
}

const STEPS: Step[] = [
  { phase: "INTENT", num: "01", side: "a", label: "scopes the task" },
  { phase: "ESCROW_LOCK", num: "02", side: "a", label: "locks funds in escrow" },
  { phase: "INTERCEPT", num: "03", side: "b", label: "ring-buffer intercept fires" },
  { phase: "PIPELINE", num: "04", side: "b", label: "verifies the proof" },
  { phase: "SETTLEMENT", num: "05", side: "b", label: "claims & settles on-chain" },
];

const ORDER: Phase[] = STEPS.map((s) => s.phase);

type StepState = "done" | "active" | "pending";

function stepState(task: Task | null, phase: Phase): StepState {
  if (!task) return "pending";
  const reached = ORDER.indexOf(task.phase);
  const idx = ORDER.indexOf(phase);
  if (idx < reached) return "done";
  if (idx === reached) {
    // The current phase is "done" once the whole task has settled/reverted.
    return task.status === "settled" || task.status === "reverted" ? "done" : "active";
  }
  return "pending";
}

const GLYPH: Record<StepState, string> = { done: "✓", active: "◐", pending: "○" };

interface TimelineProps {
  task: Task | null;
  agentA: string;
  agentB: string;
  ringLatency: number | null;
  rpcLatency: number | null;
}

function fmtMs(v: number): string {
  return v < 1 ? `${v.toFixed(2)} ms` : `${Math.round(v)} ms`;
}

export function Timeline({ task, agentA, agentB, ringLatency, rpcLatency }: TimelineProps) {
  return (
    <div className="timeline">
      {STEPS.map((step, i) => {
        const st = stepState(task, step.phase);
        const owner = step.side === "a" ? agentA : agentB;
        const detail = renderDetail(step.phase, task, ringLatency, rpcLatency);
        return (
          <div className={`tl-row tl-${st}`} key={step.phase} data-side={step.side}>
            <div className="tl-cell tl-left">
              {step.side === "a" ? <TlAction owner={owner} label={step.label} num={step.num} detail={detail} /> : null}
            </div>

            <div className="tl-spine">
              {i > 0 ? <span className="tl-connector tl-connector-top" /> : null}
              <span className="tl-node" aria-label={st}>
                {GLYPH[st]}
              </span>
              {i < STEPS.length - 1 ? <span className="tl-connector tl-connector-bottom" /> : null}
            </div>

            <div className="tl-cell tl-right">
              {step.side === "b" ? (
                <TlAction owner={owner} label={step.label} num={step.num} detail={detail} align="right" />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderDetail(
  phase: Phase,
  task: Task | null,
  ringLatency: number | null,
  rpcLatency: number | null,
): React.ReactNode {
  if (phase === "INTERCEPT" && (ringLatency != null || rpcLatency != null)) {
    return (
      <span className="tl-detail tl-latency">
        {ringLatency != null ? <span className="tl-ring">ring {fmtMs(ringLatency)}</span> : null}
        {ringLatency != null && rpcLatency != null ? <span className="tl-sep"> · </span> : null}
        {rpcLatency != null ? <span className="tl-rpc">rpc {fmtMs(rpcLatency)}</span> : null}
      </span>
    );
  }
  if (phase === "ESCROW_LOCK" && task?.phaseSeenAt.ESCROW_LOCK != null) {
    return <span className="tl-detail">0.1 MON</span>;
  }
  return null;
}

function TlAction({
  owner,
  label,
  num,
  detail,
  align = "left",
}: {
  owner: string;
  label: string;
  num: string;
  detail?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={`tl-action tl-action-${align} mono`}>
      <span className="tl-num">{num}</span>
      <span className="tl-text">
        <span className="tl-owner">{owner}</span>
        <span className="tl-label">{label}</span>
        {detail ? <span className="tl-detail-wrap">{detail}</span> : null}
      </span>
    </div>
  );
}
