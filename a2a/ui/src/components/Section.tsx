import type { ReactNode } from "react";
import "./Section.css";

interface SectionProps {
  label: string;
  // Visual tone: "input" = neutral framed, "output" = gold-accented hero.
  tone?: "input" | "output";
  children: ReactNode;
}

// A labeled, framed block that makes a region (INPUT / OUTPUT) stand out
// independently from the surrounding log stream. Eyebrow label + hairline frame.
export function Section({ label, tone = "input", children }: SectionProps) {
  return (
    <section className={`io-section io-${tone}`}>
      <div className="io-label label">{label}</div>
      <div className="io-body">{children}</div>
    </section>
  );
}
