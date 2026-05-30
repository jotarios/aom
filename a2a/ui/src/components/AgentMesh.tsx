import "./AgentMesh.css";

const REMOTE_AGENTS = [
  { id: "geo",     label: "Geospatial",  role: "NDVI compute" },
  { id: "nlp",     label: "NLP Engine",  role: "report synthesis" },
  { id: "risk",    label: "Risk Model",  role: "drought scoring" },
  { id: "storage", label: "Data Store",  role: "telemetry archive" },
];

export function AgentMesh() {
  return (
    <section className="mesh">
      <div className="mesh-eyebrow">
        <span className="label">Agent-to-agent topology</span>
        <span className="mesh-note mono">one client agent · many specialist workers · each paid on-chain</span>
      </div>

      <div className="mesh-diagram" aria-label="Agent mesh topology diagram">

        {/* ── Left: end-user → client → client agent ── */}
        <div className="mesh-left">
          <div className="mesh-node mesh-node--user">
            <span className="mesh-node-glyph mono" aria-hidden>◎</span>
            <span className="mesh-node-label">End-User</span>
          </div>

          <div className="mesh-connector mesh-connector--h">
            <div className="mesh-pulse mesh-pulse--1" aria-hidden />
          </div>

          <div className="mesh-node mesh-node--client">
            <span className="mesh-node-glyph mono" aria-hidden>▣</span>
            <span className="mesh-node-label">Client</span>
          </div>

          <div className="mesh-connector mesh-connector--h">
            <div className="mesh-pulse mesh-pulse--2" aria-hidden />
          </div>

          <div className="mesh-node mesh-node--agent-a">
            <span className="mesh-node-glyph mono" aria-hidden>⬡</span>
            <span className="mesh-node-label">Client Agent</span>
            <span className="mesh-node-sub mono">Macro Buyer</span>
          </div>
        </div>

        {/* ── Center: SVG fan-out ── */}
        <svg
          className="mesh-svg"
          viewBox="0 0 80 240"
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* stem from left edge to branch point */}
          <line className="mesh-line mesh-line--stem" x1="0" y1="120" x2="40" y2="120" />
          {/* vertical spine */}
          <line className="mesh-line mesh-line--spine" x1="40" y1="30" x2="40" y2="210" />
          {/* four branches to the right */}
          <line className="mesh-line mesh-line--branch mesh-line--b0" x1="40" y1="30"  x2="80" y2="30" />
          <line className="mesh-line mesh-line--branch mesh-line--b1" x1="40" y1="90"  x2="80" y2="90" />
          <line className="mesh-line mesh-line--branch mesh-line--b2" x1="40" y1="150" x2="80" y2="150" />
          <line className="mesh-line mesh-line--branch mesh-line--b3" x1="40" y1="210" x2="80" y2="210" />
          {/* arrowheads */}
          <polygon className="mesh-arrow mesh-arrow--b0" points="76,26 84,30 76,34" />
          <polygon className="mesh-arrow mesh-arrow--b1" points="76,86 84,90 76,94" />
          <polygon className="mesh-arrow mesh-arrow--b2" points="76,146 84,150 76,154" />
          <polygon className="mesh-arrow mesh-arrow--b3" points="76,206 84,210 76,214" />
          {/* animated pulse dot travelling along stem */}
          <circle className="mesh-dot mesh-dot--stem" cx="0" cy="120" r="3" />
        </svg>

        {/* ── Right: remote agent mesh ── */}
        <div className="mesh-right">
          <span className="mesh-mesh-label mono">Remote Agent Mesh</span>
          <ul className="mesh-agents" role="list">
            {REMOTE_AGENTS.map((agent, i) => (
              <li className="mesh-agent" key={agent.id} style={{ "--agent-i": i } as React.CSSProperties}>
                <span className="mesh-settled mono" aria-label="settled">●</span>
                <div className="mesh-agent-info">
                  <span className="mesh-agent-name">{agent.label}</span>
                  <span className="mesh-agent-role mono">{agent.role}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mesh-caption mono">
        Any agent can hire any specialist · each sub-task settles its micro-payment independently · the whole mesh closes in under a second
      </p>
    </section>
  );
}
