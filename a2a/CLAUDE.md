# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repo is **pre-implementation**. Only planning artifacts exist so far:
`docs/prd.md` (the requirements) and `DESIGN.md` (the UI/visual source of truth).
There is no source code, build system, or test tooling yet. When scaffolding,
follow the stack and architecture the PRD and DESIGN.md prescribe — both are
authoritative and described below. Read both before generating code.

## What this is

**Agentic Open Market (AOM)** — a hackathon (Blitz Buenos Aires 2026) demo of an
agent-to-agent marketplace on Monad. An autonomous "macro buyer" agent hires a
"geospatial engine" agent to compute crop vegetation indices (NDVI) and settles
the micro-payment on-chain. The differentiator: bypassing JSON-RPC polling latency
by reading Monad's execution-events shared-memory ring buffer to trigger the
off-chain pipeline, settling in sub-second time. **The live demo is the product** —
the whole system exists to make machine-speed on-chain settlement legible to a
human audience watching a pitch.

## Architecture (three planes)

The design strictly separates heavy compute from fast Monad settlement. There are
three cooperating processes plus the contract:

1. **Agent A — Macro Buyer** (Python script): decides when to trigger an
   environmental audit, then calls `lockFunds(bytes32 taskId, address agentB)` on
   the escrow contract to lock funds (e.g. 0.1 MON) in escrow.
2. **The Bridge — Execution SDK Sidecar** (Rust, `tokio` + `monad-exec-events`):
   reads the local Monad node's `hugetlbfs` shared-memory ring buffer to intercept
   `TxnLog` / `TaskFunded` events *instantly* (microsecond-scale), then fires a
   WebSocket trigger to Agent B. This is the latency trick — adapt boilerplate from
   Monad's `monode` repo; it only needs to filter for one contract address and emit
   one WebSocket event.
3. **Agent B — Geospatial Engine** (Dockerized Python/FastAPI): on trigger, ingests
   satellite telemetry (`.tif` files, EPSG:4326 projection), computes
   `NDVI = (NIR − Red) / (NIR + Red)` per plot, hashes the report, and calls
   `completeTask()` to submit the hash and claim the escrow.
4. **`AgentEscrow.sol`** (Solidity, Monad testnet): holds Agent A's funds and
   releases them to Agent B only when a verifiable hash of the report is submitted.

**Event flow:** Agent A `lockFunds` → Monad speculatively executes, writes
`TaskFunded` to the ring buffer → Rust sidecar intercepts → WebSocket fires Agent B
→ Agent B computes NDVI, submits hash via `completeTask` → escrow releases →
`TaskCompleted`. The UI must surface each of these transitions in under a second.

The web UI is a split-screen console: **left = Agent A** (gold-tinted, the value
side, a log stream), **right = Agent B** (pearl-tinted, the compute side, NDVI/data
view), **bottom = the Monad ledger ticker** (full-width, block #, sub-second
finality, `TaskFunded → TaskCompleted`). The center seam animates a gold pulse
left→right when the sidecar fires — that animation *is* "the microsecond intercept
made visible."

## Hackathon constraints (1-day sprint — do not over-build)

- **Mock the satellite data.** No live Sentinel/Landsat API calls. Pre-load a
  directory of `.tif` files for one agricultural zone; Agent B reads from local disk.
- **Keep the Rust sidecar minimal.** One contract-address filter, one WebSocket
  emit. Don't generalize it.
- Scope everything to the demo path. If a feature isn't visible in the live
  split-screen run, it's probably out of scope.

## Intended stack

- **On-chain:** Solidity 0.8.27+, **Foundry** (use `forge script`, not `forge create`),
  `evm_version = "prague"`. Monad **testnet** — chain ID `10143`,
  RPC `https://testnet-rpc.monad.xyz`. Verify every deployed contract.
- **Sidecar:** Rust, `tokio`, `monad-exec-events` SDK.
- **Agent B:** Python, FastAPI, Docker.
- **Frontend:** React 19, TanStack + TanStack Query, viem/wagmi
  (import `monadTestnet` from `viem/chains`), Tailwind CSS, shadcn/ui, Vercel AI SDK.
- Other preferences from the PRD (use as needed, not all required for the demo):
  Clerk (auth), Supabase/Neon + Drizzle (DB/ORM), Trigger.dev (jobs), Resend (email),
  Vercel (deploy).

## On-chain work: use the `monad-development` skill

For all Monad on-chain tasks — scaffolding/deploying `AgentEscrow.sol`, funding a
testnet wallet via the agent faucet, verifying contracts (MonadVision, Socialscan,
Monadscan), and wiring the viem/wagmi frontend — invoke the **`monad-development`**
Claude skill. It enforces the testnet/Foundry/prague defaults listed above, so
prefer it over hand-rolling deployment commands.

## UI work: DESIGN.md is binding

`DESIGN.md` is the design source of truth and every UI decision is calibrated
against it. Load it before building any frontend. The non-negotiables that are
easy to violate by accident:

- **Dark-locked, no light mode** (`color-scheme: dark`). Define colors as CSS
  variables in `:root`; never hardcode hex in components.
- **One gold accent** (`--forged-gold`), reserved for brand mark, the single
  primary action per view, and the on-chain settlement moment. Pearl is the cool
  co-accent for Agent B / "computing." If gold is everywhere, the settlement
  moment stops reading.
- **Mono (`Geist Mono`) for all machine state** — logs, tx hashes, block #s,
  latency, agent IDs, NDVI, coordinates, button labels, status pills — with
  `tabular-nums`. **Sans (`Geist`) for human headings/prose only.** Geist is the
  brand voice; do not fall back to `system-ui` as the primary font.
- **Status by glyph + color + label**, never color alone: `● settled` (green),
  `○ pending` (gold ring), `◐ computing` (pearl), `✕ reverted` (red).
- Animate **only `transform` and `opacity`** (the log stream must not jank); never
  `transition: all`. Honor `prefers-reduced-motion`. The three intentional motions
  are the seam pulse, the ledger settle "tick," and per-line log entrance.
- DESIGN.md §8 lists hard AI-slop rejections (no purple gradients, no icon-in-circle
  feature grids, no decorative blobs in the working console, no emoji as design
  elements, no colored left-borders). Check changes against that list.
