import type { Scenario } from "@aom/shared";
import "./ScenarioGrid.css";

interface ScenarioGridProps {
  scenarios: Scenario[];
  onSelect: (id: string) => void;
}

// The scenario picker grid. Cards lead with the OUTCOME (what you get), then demote
// the agentA → agentB pair to a "hires" subtitle with a specialist role caption.
// The scenario emoji carries the identity; the single/race mode badge is omitted.
export function ScenarioGrid({ scenarios, onSelect }: ScenarioGridProps) {
  return (
    <ul className="sg-grid" role="list">
      {scenarios.map((s) => (
        <li key={s.id}>
          <button
            className="sg-card"
            type="button"
            onClick={() => onSelect(s.id)}
            aria-label={`Launch ${s.story.outcome ?? s.story.hook}`}
          >
            <div className="sg-card-head">
              <div className="sg-title">
                {s.story.icon ? (
                  <span className="sg-icon" aria-hidden>
                    {s.story.icon}
                  </span>
                ) : null}
                <h3 className="sg-outcome">{s.story.outcome ?? s.story.hook}</h3>
              </div>
            </div>

            {/* agentA HIRES agentB — the thesis, made legible on the card. */}
            <div className="sg-hires mono">
              <span className="sg-agent sg-agent--a">{s.story.agentA}</span>
              <span className="sg-hires-verb">hires</span>
              <span className="sg-agent sg-agent--b">{s.story.agentB}</span>
            </div>
            {s.story.agentBRole ? <p className="sg-role mono">{s.story.agentBRole}</p> : null}

            <p className="sg-hook">{s.story.hook}</p>

            <div className="sg-card-foot">
              <span className="sg-amount mono">{s.amountMon} MON</span>
              <span className="sg-cta-hint mono">Launch →</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
