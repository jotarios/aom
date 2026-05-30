import "./HowItWorks.css";

interface Step {
  num: string;
  glyph: string; // geometric status glyph (DESIGN.md §2) — not emoji
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  { num: "01", glyph: "○", title: "One agent needs a job done", detail: "It sets the payment aside up front, so the other agent knows the money is there." },
  { num: "02", glyph: "◐", title: "The other agent is hired instantly", detail: "We spot the payment the moment it lands — no waiting, no checking back." },
  { num: "03", glyph: "●", title: "Work delivered, money paid", detail: "The job is done and the payment is released automatically — in under a second." },
];

// "How a hire settles" — a numbered 3-step strip that turns the hero's latency race
// into a repeatable mental model, priming the scenario click (adapted from licit.ar's
// how-it-works placement). Geometric glyphs, no emoji (DESIGN.md §2/§8).
export function HowItWorks() {
  return (
    <section className="hiw">
      <div className="hiw-eyebrow">
        <span className="label">How a hire settles</span>
        <span className="hiw-note mono">request → deliver → paid · in one second</span>
      </div>

      <ol className="hiw-row" role="list">
        {STEPS.map((s, i) => (
          <li className={`hiw-step hiw-step--${i}`} key={s.num}>
            <div className="hiw-step-head">
              <span className="hiw-num mono">{s.num}</span>
              <span className="hiw-glyph mono" aria-hidden>
                {s.glyph}
              </span>
            </div>
            <h3 className="hiw-title">{s.title}</h3>
            <p className="hiw-detail">{s.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
