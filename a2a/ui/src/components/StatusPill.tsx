import type { Status } from "@aom/shared";
import "./StatusPill.css";

const GLYPH: Record<Status, string> = {
  settled: "●",
  pending: "○",
  computing: "◐",
  reverted: "✕",
};

const LABEL: Record<Status, string> = {
  settled: "settled",
  pending: "pending",
  computing: "computing",
  reverted: "reverted",
};

// Status by glyph + color + label, never color alone (DESIGN.md §2/§5).
export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`status-pill mono status-${status}`}>
      <span className="status-glyph" aria-hidden>
        {GLYPH[status]}
      </span>
      {LABEL[status]}
    </span>
  );
}
