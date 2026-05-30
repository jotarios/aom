import type { HubStatus } from "../useHub";
import type { Phase } from "@aom/shared";
import "./TopBar.css";

const PHASES: { num: string; label: Phase | "INTERCEPT" }[] = [
  { num: "01", label: "INTENT" },
  { num: "02", label: "ESCROW_LOCK" },
  { num: "03", label: "INTERCEPT" },
  { num: "04", label: "PIPELINE" },
  { num: "05", label: "SETTLEMENT" },
];

export function TopBar({ activePhase, hubStatus, onHome }: { activePhase: Phase | null; hubStatus: HubStatus; onHome?: () => void }) {
  return (
    <header className="topbar">
      <button className="topbar-brand mono" onClick={onHome} type="button">
        <span className="topbar-mark" aria-hidden>
          ⬣
        </span>
        Agentic Open Market
      </button>
      <nav className="topbar-phases mono">
        {PHASES.map((p) => (
          <span key={p.num} className={`topbar-phase ${activePhase === p.label ? "topbar-phase-active" : ""}`}>
            <span className="topbar-phase-num">{p.num}</span> {p.label.replace("_", " ")}
          </span>
        ))}
      </nav>
      <div className="topbar-status mono">
        <span className={`topbar-dot topbar-dot-${hubStatus}`} aria-hidden>
          ●
        </span>
        {hubStatus === "open" ? "connected · testnet 10143" : hubStatus === "reconnecting" ? "reconnecting…" : "connecting…"}
      </div>
    </header>
  );
}
