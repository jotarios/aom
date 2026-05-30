import type { LedgerEntry } from "../state";
import { ChainLink } from "./ChainLink";
import "./Output.css";

interface OutputProps {
  amountMon: string;
  recipient: string; // Agent B display name
  // Most recent settlement (if any). null before the first settle.
  settlement: LedgerEntry | null;
}

// The OUTPUT section — the money. Hero-sized MON value in gold, with the settle
// status, finality latency, and the on-chain tx once it lands.
export function Output({ amountMon, recipient, settlement }: OutputProps) {
  const settled = settlement?.kind === "settled";
  const latency = settlement?.latencyMs ?? null;

  return (
    <div className="output">
      <div className="output-amount mono">
        <span className="output-value">{amountMon}</span>
        <span className="output-unit">MON</span>
      </div>
      <div className="output-meta mono">
        <span className={`output-status ${settled ? "output-settled" : "output-pending"}`}>
          {settled ? "● settled" : "○ awaiting settlement"}
        </span>
        {settled ? <span className="output-to">→ {recipient}</span> : null}
      </div>
      {settled ? (
        <div className="output-detail mono">
          {latency != null ? (
            <span className="output-latency">
              finality <strong>{latency < 1 ? latency.toFixed(2) : Math.round(latency)}</strong> ms
            </span>
          ) : null}
          {settlement?.txHash ? <ChainLink value={settlement.txHash} kind="tx" /> : null}
        </div>
      ) : null}
    </div>
  );
}
