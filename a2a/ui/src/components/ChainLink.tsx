import "./ChainLink.css";

// Monad testnet explorer (MonadVision). Override with VITE_EXPLORER if needed.
const EXPLORER = (import.meta.env.VITE_EXPLORER as string | undefined) ?? "https://testnet.monadvision.com";

function truncMid(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

interface ChainLinkProps {
  value: string;
  // "address" → /address/…, "tx" → /tx/…
  kind: "address" | "tx";
  // Optional override for the visible text (defaults to a middle-truncated value).
  label?: string;
}

// A click-to-open chain reference: the truncated value links out to the Monad
// explorer with a small external glyph. Geometric glyph only (↗), mono — DESIGN.md §5/§8.
export function ChainLink({ value, kind, label }: ChainLinkProps) {
  const href = `${EXPLORER}/${kind === "address" ? "address" : "tx"}/${value}`;
  return (
    <a
      className={`chain-link mono chain-${kind}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Open ${value} on the explorer`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="chain-value">{label ?? truncMid(value)}</span>
      <span className="chain-glyph" aria-hidden>
        ↗
      </span>
    </a>
  );
}
