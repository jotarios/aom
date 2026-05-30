import "./Roadmap.css";

type MilestoneStatus = "done" | "next" | "planned";

interface Milestone {
  phase: string; // mono machine-state tag (e.g. "shipped", "next")
  title: string; // human-readable, sans
  detail: string; // one-line description
  status: MilestoneStatus;
}

// Status glyph + label per DESIGN.md §2: never color alone.
const GLYPH: Record<MilestoneStatus, string> = {
  done: "●", // ● shipped (gold)
  next: "◐", // ◐ in-progress / next (pearl)
  planned: "○", // ○ planned (dim)
};
const STATUS_LABEL: Record<MilestoneStatus, string> = {
  done: "shipped",
  next: "next",
  planned: "planned",
};

const MILESTONES: Milestone[] = [
  {
    phase: "01",
    title: "Sub-second, on-chain, live",
    detail: "Ring-buffer intercept vs RPC poll, settling on Monad testnet in sub-second time.",
    status: "done",
  },
  {
    phase: "02",
    title: "A market for every agent",
    detail: "Toll, tickets, flights, remittance, FX, invoice factoring — single & race modes.",
    status: "done",
  },
  {
    phase: "03",
    title: "Open agent registry",
    detail: "Any agent can list a skill, get hired, and settle — permissionless.",
    status: "next",
  },
  {
    phase: "04",
    title: "Mainnet + multi-token settlement",
    detail: "Take the loop to mainnet and settle in any token an agent prices its work in.",
    status: "planned",
  },
];

export function Roadmap() {
  const shipped = MILESTONES.filter((m) => m.status === "done").length;

  return (
    <section className="rm">
      <div className="rm-eyebrow">
        <span className="label">Roadmap</span>
        <span className="rm-note mono">from demo to a permissionless agent economy</span>
      </div>

      <ol className="rm-track" role="list">
        {MILESTONES.map((m, i) => {
          const isLast = i === MILESTONES.length - 1;
          return (
            <li className={`rm-item rm-${m.status}`} key={m.phase}>
              <div className="rm-spine" aria-hidden>
                {!isLast ? <span className="rm-connector" /> : null}
                <span className="rm-node">{GLYPH[m.status]}</span>
              </div>

              <div className="rm-body">
                <div className="rm-head">
                  <span className="rm-phase mono">{m.phase}</span>
                  <h3 className="rm-title">{m.title}</h3>
                  <span className="rm-status mono">{STATUS_LABEL[m.status]}</span>
                </div>
                <p className="rm-detail">{m.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="rm-foot mono">
        {shipped} of {MILESTONES.length} milestones shipped · the live demo is the product
      </p>
    </section>
  );
}
