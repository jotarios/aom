import "./AgentShowcase.css";

interface AgentBrand {
  name: string;
  role: string; // the verb/specialty
}

// Recognizable agent archetypes, branded — the "agents you already use" social proof
// row (adapted from Agent Exchange's featured-agents section). These illustrate the
// kind of specialists AOM is built for; they are not live integrations.
const BRANDS: AgentBrand[] = [
  { name: "Cursor", role: "ships code" },
  { name: "Vercel", role: "deploys" },
  { name: "Linear", role: "triages issues" },
  { name: "Notion", role: "syncs docs" },
  { name: "OpenAI", role: "reasons" },
  { name: "Stripe", role: "settles billing" },
];

export function AgentShowcase() {
  return (
    <section className="as">
      <div className="as-eyebrow">
        <span className="label">Built for the agents you already use</span>
        <span className="as-note mono">any agent can hire any other — and settle on-chain</span>
      </div>

      <ul className="as-row" role="list">
        {BRANDS.map((b) => (
          <li className="as-card" key={b.name}>
            <span className="as-name">{b.name}</span>
            <span className="as-role mono">{b.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
