import "./OnChainProof.css";

const EXPLORER = (import.meta.env.VITE_EXPLORER as string | undefined) ?? "https://testnet.monadvision.com";

interface ProofStat {
  label: string;
  value: string;
  href?: string;
  gold?: boolean;
}

// "Verified on Monad testnet" — our honest substitute for social proof. A hackathon
// demo has no customers, but it has a real, deployed, verified contract. Hard-to-fake
// credibility (adapted from licit.ar's confidence close + stat spine).
export function OnChainProof() {
  const escrow = import.meta.env.VITE_ESCROW_ADDRESS;
  const escrowShort = escrow ? `${escrow.slice(0, 10)}…${escrow.slice(-6)}` : "—";

  const stats: ProofStat[] = [
    { label: "escrow contract", value: escrowShort, ...(escrow ? { href: `${EXPLORER}/address/${escrow}` } : {}) },
    { label: "chain", value: "Monad testnet · 10143" },
    { label: "verification", value: "● verified", gold: true },
    { label: "settlement", value: "real, on-chain" },
  ];

  return (
    <section className="ocp">
      <div className="ocp-eyebrow">
        <span className="label">Verified on Monad testnet</span>
        <span className="ocp-note mono">no slides — a real contract, settling real value</span>
      </div>

      <dl className="ocp-grid">
        {stats.map((s) => (
          <div className="ocp-stat" key={s.label}>
            <dt className="ocp-stat-label mono">{s.label}</dt>
            <dd className={`ocp-stat-value mono ${s.gold ? "ocp-gold" : ""}`}>
              {s.href ? (
                <a className="ocp-link" href={s.href} target="_blank" rel="noreferrer">
                  {s.value} ↗
                </a>
              ) : (
                s.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
