import type { ReactNode } from "react";
import { ChainLink } from "./ChainLink";
import "./AgentPanel.css";

interface AgentPanelProps {
  side: "a" | "b";
  prefix: string; // e.g. "Agent A · the buyer"
  name: string; // the agent's display name (title)
  description?: string; // one-line description of the agent's job
  active: boolean;
  statusDot: ReactNode;
  address?: string;
  children?: ReactNode;
}

// Option A header: prefix eyebrow · name title · one-line description, with the
// status pill + wallet on the right.
export function AgentPanel({ side, prefix, name, description, active, statusDot, address, children }: AgentPanelProps) {
  return (
    <section className={`agent-panel agent-${side} ${active ? "agent-active" : ""}`}>
      <header className="agent-head">
        <div className="agent-title">
          <span className={`agent-prefix mono agent-prefix-${side}`}>{prefix}</span>
          <span className="agent-name">{name}</span>
        </div>
        <div className="agent-meta">
          {statusDot ? <span className="agent-dot">{statusDot}</span> : null}
          {address ? (
            <span className="agent-wallet mono">
              <ChainLink value={address} kind="address" />
            </span>
          ) : null}
        </div>
      </header>
      {description ? <p className="agent-desc mono">{description}</p> : null}
      {children ? <div className="agent-body">{children}</div> : null}
    </section>
  );
}
