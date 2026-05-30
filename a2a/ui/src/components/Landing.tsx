import type { Scenario } from "@aom/shared";
import { useRef } from "react";
import { ScenarioGrid } from "./ScenarioGrid";
import { AgentShowcase } from "./AgentShowcase";
import { AgentMesh } from "./AgentMesh";
import { HowItWorks } from "./HowItWorks";
import { Roadmap } from "./Roadmap";
import { OnChainProof } from "./OnChainProof";
import "./Landing.css";

interface LandingProps {
  scenarios: Scenario[];
  onSelect: (id: string) => void;
}

const EXPLORER = (import.meta.env.VITE_EXPLORER as string | undefined) ?? "https://testnet.monadvision.com";

export function Landing({ scenarios, onSelect }: LandingProps) {
  const gridRef = useRef<HTMLElement>(null);
  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Footer trust signal (#8): link the verified escrow contract.
  const escrowAddr = import.meta.env.VITE_ESCROW_ADDRESS;
  const escrowShort = escrowAddr ? `${escrowAddr.slice(0, 8)}…${escrowAddr.slice(-4)}` : "";
  const escrowUrl = escrowAddr ? `${EXPLORER}/address/${escrowAddr}` : "";

  return (
    <div className="lp">
      <div className="lp-glow" aria-hidden />

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="lp-hero">
        <div className="lp-mark mono">
          <span className="lp-hex" aria-hidden>⬣</span>
          Agentic Open Market
        </div>

        <h1 className="lp-headline">
          Agents that hire agents.
          <br />
          <span className="lp-gold">Paid in milliseconds.</span>
        </h1>

        <p className="lp-lede">
          An autonomous agent locks funds, hires a specialist, and pays it the instant the work is
          verified — the whole loop closing on-chain in under a second.
        </p>

        <div className="lp-actions">
          <button className="cta cta--primary" type="button" onClick={scrollToGrid}>
            See it settle live ↓
          </button>
          <span className="lp-meta mono">sub-second finality · Monad testnet</span>
        </div>

        {/* The differentiator, made tangible — a looping race (#4). The ring bar snaps
            to settled almost instantly; the rpc bar crawls. transform/opacity only. */}
        <div className="lp-race" aria-hidden>
          <div className="lp-race-row">
            <span className="lp-race-tag mono">ring · we intercept</span>
            <div className="lp-track">
              <div className="lp-fill lp-fill--ring" />
            </div>
            <span className="lp-race-val mono lp-race-val--ring">~0.6 ms</span>
          </div>
          <div className="lp-race-row">
            <span className="lp-race-tag mono">rpc · everyone polls</span>
            <div className="lp-track">
              <div className="lp-fill lp-fill--rpc" />
            </div>
            <span className="lp-race-val mono lp-race-val--rpc">~1,400 ms</span>
          </div>
        </div>
        <p className="lp-rail-note mono">
          We read Monad's execution-events stream directly instead of polling it. Watch the race, live.
        </p>
      </header>

      {/* ── How a hire settles (3 steps) ─────────────────── */}
      <HowItWorks />

      {/* ── Agent-to-agent mesh topology ─────────────────── */}
      <AgentMesh />

      {/* ── Scenario picker ──────────────────────────────── */}
      <section className="lp-section" ref={gridRef}>
        <div className="lp-eyebrow">
          <span className="label">Select a scenario</span>
          {/* On-thesis proof stat (#3): restate the differentiator at decision time. */}
          <span className="lp-count mono">
            {scenarios.length} scenarios · median settle &lt; 1s · 0 polling
          </span>
        </div>
        <ScenarioGrid scenarios={scenarios} onSelect={onSelect} />
      </section>

      {/* ── "Agents you already use" social-proof row ────── */}
      <AgentShowcase />

      {/* ── Roadmap ──────────────────────────────────────── */}
      <Roadmap />

      {/* ── Verified-on-chain proof (honest social-proof substitute) ─── */}
      <OnChainProof />

      <footer className="lp-footer mono">
        Monad testnet · chain 10143
        {escrowAddr ? (
          <>
            {" · escrow "}
            <a className="lp-escrow-link" href={escrowUrl} target="_blank" rel="noreferrer">
              {escrowShort} ↗
            </a>
            {" · verified"}
          </>
        ) : (
          " · the live demo is the product"
        )}
      </footer>
    </div>
  );
}
