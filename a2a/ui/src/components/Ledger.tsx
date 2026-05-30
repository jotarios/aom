import { useEffect, useRef, useState } from "react";
import type { LedgerEntry } from "../state";
import { ChainLink } from "./ChainLink";
import "./Ledger.css";

interface LedgerProps {
  entries: LedgerEntry[];
  latestBlock: number | null;
}

// The Monad ledger ticker (1D.4 / T8) — block #, the latency hero metric, and the
// recent TaskFunded → TaskCompleted / Reverted lines. In a race this shows the whole
// cascade together (1 settled + N reverts) so the winner isn't hidden behind a revert.
// On a new settlement the strip flashes gold (the settle "tick").
export function Ledger({ entries, latestBlock }: LedgerProps) {
  const [tick, setTick] = useState(0);
  const lastCount = useRef(0);

  useEffect(() => {
    if (entries.length > lastCount.current) {
      const newest = entries[entries.length - 1];
      if (newest?.kind === "settled") setTick((t) => t + 1);
    }
    lastCount.current = entries.length;
  }, [entries.length]);

  // Show the most recent settlement and any reverts that came with it (same round).
  // Walk back from the end collecting the trailing reverts + the settlement they follow.
  const recent = recentCascade(entries);
  const settled = recent.find((e) => e.kind === "settled") ?? null;
  const heroLatency = settled?.latencyMs ?? null;
  const subSecond = heroLatency != null && heroLatency < 1000;

  return (
    <footer className={`ledger ${tick > 0 ? "ledger-tick" : ""}`} key={tick}>
      <div className="ledger-left">
        <span className="label">Monad Ledger</span>
        <span className="ledger-block mono">block #{latestBlock ?? "——"}</span>
        <span className="ledger-net mono">testnet 10143</span>
      </div>

      <div className="ledger-center mono">
        {recent.length > 0 ? (
          <div className="ledger-cascade">
            {recent.map((e, i) => (
              <span className={`ledger-pair ledger-${e.kind}`} key={`${e.taskId}-${i}`}>
                {e.kind === "settled" ? "● Funded → Completed" : "✕ Funded → Reverted"}
                {e.txHash ? (
                  <span className="ledger-hash">
                    {" "}
                    <ChainLink value={e.txHash} kind="tx" />
                  </span>
                ) : null}
                <span className="ledger-msg"> · {e.msg}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="ledger-idle">awaiting first settlement…</span>
        )}
      </div>

      <div className="ledger-right">
        <span className="label">finality</span>
        <span className={`ledger-latency mono ${subSecond ? "ledger-latency-sub" : ""}`}>
          {heroLatency != null ? (
            <>
              {heroLatency < 1 ? heroLatency.toFixed(2) : Math.round(heroLatency)}
              <span className="ledger-unit"> ms</span>
            </>
          ) : (
            "——"
          )}
        </span>
      </div>
    </footer>
  );
}

// The trailing run of entries belonging to the latest round: the most recent
// settlement plus any reverts that followed it (the losing-bid refunds). If the most
// recent activity is reverts with no preceding settlement in the window, show those.
function recentCascade(entries: LedgerEntry[]): LedgerEntry[] {
  if (entries.length === 0) return [];
  const out: LedgerEntry[] = [];
  for (let i = entries.length - 1; i >= 0 && out.length < 6; i--) {
    out.unshift(entries[i]!);
    if (entries[i]!.kind === "settled") break; // stop once we've captured the round's settlement
  }
  return out;
}
