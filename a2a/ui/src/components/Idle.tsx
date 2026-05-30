import type { Scenario } from "@aom/shared";
import "./Idle.css";

interface IdleProps {
  scenario: Scenario;
  onTrigger: () => void;
  onBack?: () => void;
}

export function Idle({ scenario, onTrigger, onBack }: IdleProps) {
  return (
    <div className="idle">
      <div className="idle-glow" aria-hidden />
      <div className="idle-inner">
        {onBack && (
          <button className="idle-back mono" type="button" onClick={onBack}>
            ← all scenarios
          </button>
        )}
        <div className="idle-mark mono">
          <span className="idle-hex" aria-hidden>⬣</span>
          AOM
        </div>
        <h1 className="idle-title">Agentic Open Market</h1>
        <div className="idle-scenario">
          {scenario.story.icon ? (
            <span className="idle-scenario-icon" aria-hidden>
              {scenario.story.icon}
            </span>
          ) : null}
          {scenario.story.outcome ? <span className="idle-scenario-outcome">{scenario.story.outcome}</span> : null}
        </div>
        <p className="idle-hook mono">{scenario.story.hook}</p>
        <button className="cta cta--primary" onClick={onTrigger} type="button">
          Trigger audit
        </button>
        <p className="idle-sub mono">
          {scenario.story.agentA} hires {scenario.story.agentB} · settled on Monad in sub-second time
        </p>
      </div>
    </div>
  );
}
