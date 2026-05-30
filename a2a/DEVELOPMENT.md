# AOM — Agentic Open Market

A dual-rail latency-race demo on Monad. An autonomous **Agent A** hires **Agent B**
to verify a proof and settle a micro-payment on-chain — and the UI makes the
machine-speed settlement legible by racing a ring-buffer-style intercept against a
JSON-RPC poll, live.

> Blitz Buenos Aires 2026. The live demo is the product.

## Architecture (three planes + contract)

- **`contracts/AgentEscrow.sol`** — escrow with single + race modes (Foundry, Monad
  testnet 10143, deployed + verified). Single = race with `resourceId == 0`.
- **`hub/`** — standalone WS broadcast relay (Node). The integration contract is one
  validated event stream (`schema/schema.json`). Everything publishes; the UI subscribes.
- **`bridge/`** — Rust dual-rail sidecar: a real `eth_getLogs` poll @250ms (`rail:rpc`)
  plus a ring rail (snapshot replay / live-lock shadow / `--features sdk` live reader).
- **`agent-a/`** — Macro Buyer (Python). Fires `lockFunds` (1 in single, N in race),
  single-flight, auto-refunds losing race bids.
- **`agent-b/`** — Geospatial Engine (Python/FastAPI). On a `rail:ring` intercept,
  computes the proof hash and calls `completeTask` gated on the funding receipt.
- **`ui/`** — React 19 + Vite split-screen console (DESIGN.md): Agent A left (gold),
  Agent B right (pearl), the seam race in the center, the Monad ledger ticker below.

## Scenarios (scenario-agnostic engine)

One JSON file per scenario in `scenarios/`, validated against
`scenarios.schema.json`. `SCENARIO=<id>` selects the active one for every process.
Adding a single-mode scenario is one JSON file + one `data/<id>/report.json` — zero code.

| id | mode | wallets | panel |
|---|---|---|---|
| `toll` | single | 1 | keyvalue |
| `remittance` | single | 1 | table |
| `peso-shield` | single | 1 | balance |
| `invoice-factoring` | single | 1 | keyvalue |
| `concert` | race | 3 | table |
| `flight-seat` | race | 5 | table |

## Prerequisites

- Node 22 + pnpm, Python 3.11+ + uv, Rust/cargo, Foundry (`~/.foundry/bin`).
- A funded Monad testnet wallet pair in `.env` (copy from `.env.example`). Agent A is
  the deployer + funder; Agent B needs its own gas wallet for `completeTask`.

## Setup

```bash
pnpm install                                   # JS workspace (shared, hub, ui, tools)
(cd common && uv venv && uv pip install -e . pytest)
(cd agent-a && uv venv && uv pip install -e .)
(cd agent-b && uv venv && uv pip install -e .)
(cd bridge && cargo build)
```

Contract is already deployed + verified (`ESCROW_ADDRESS` in `.env`). To redeploy:

```bash
cd contracts
forge test                                     # 17 paths, single + race
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$MONAD_TESTNET_RPC" --private-key "$AGENT_A_PRIVATE_KEY" --broadcast
# then update ESCROW_ADDRESS in .env and re-export shared/abi/ via cast sig-event
```

## Run the demo

Pick the scenario once and export it to every process (5.6):

```bash
export SCENARIO=toll        # or concert / flight-seat / remittance / peso-shield / invoice-factoring
```

In separate terminals (or via `scripts/run-demo.sh`):

```bash
pnpm hub                                        # 1. WS hub (do first)
(cd bridge && ./target/debug/bridge)            # 2. dual-rail sidecar (rpc live + ring shadow)
(cd agent-b && uv run python -m app.engine)     # 3. Agent B
(cd agent-a && uv run python -m aom_agent_a.main)  # 4. Agent A (autonomous loop + button)
pnpm ui                                         # 5. UI → http://localhost:5173
```

Click **Trigger audit** (or let the autonomous loop fire). The seam pulse travels
left→right on each ring intercept; the ledger ticks gold on settlement.

### Rail modes

- **mode-b (default, any OS):** the rpc rail shadow-emits `rail:ring` per live lock —
  the demo is driven by the real on-chain lock. Narrate: "the reader is real; it
  shadows the live lock here and runs live on a Linux node."
- **pure replay (any OS):** `RING_CAPTURE=data/snapshot/capture.sample.json` runs the
  real decode/filter/latency path on a captured event sequence (no live node).
- **live SDK (Linux node):** `cargo build --features sdk` + implement
  `ring_rail::sdk::run_live` (see TODOS.md). Set `SHADOW_RING=0`, unset `RING_CAPTURE`.

### Backup RPC (5.2)

If the public testnet RPC rate-limits the 250ms poll, set `MONAD_TESTNET_RPC` to a
backup endpoint before the run.

### Cloudflare Tunnel (remote access for judges)

To let judges browse the UI on their phones while the backend runs locally:

```bash
# Terminal 1 — start tunnel + hub (captures the URL automatically)
./scripts/start-tunnel.sh

# Terminal 2 — start the rest of the demo, pointing UI at the tunnel
VITE_HUB_URL=wss://abc-xyz-123.trycloudflare.com SCENARIO=toll ./scripts/run-demo.sh

# Optional: deploy UI to Vercel with the tunnel URL baked in
./scripts/start-tunnel.sh --vercel          # preview deploy
./scripts/start-tunnel.sh --vercel --prod   # production deploy
```

> The tunnel URL changes on every restart. Start `start-tunnel.sh` first, copy
> the printed `wss://` URL, then run `run-demo.sh` with it. Keep both terminals
> alive for the duration of the demo.

### Demo-day checklist

- [ ] Wallets funded (Agent A + Agent B), `ESCROW_ADDRESS` set.
- [ ] One successful settlement logged before doors open (pre-warm, 5.5).
- [ ] `prefers-reduced-motion` is **OFF** on the stage machine (the seam pulse is the
      money shot — accepted risk, verify the setting, 5.3).
- [ ] Dry-run the chosen scenario 2–3× on the actual hardware (5.4).
- [ ] If using tunnel: start `start-tunnel.sh` first, confirm tunnel URL printed,
      then launch `run-demo.sh` with `VITE_HUB_URL=wss://…` in the same env.

## Tests

```bash
pnpm --filter @aom/tools test                  # schema conformance + 2 E2E (single + race)
pnpm --filter @aom/hub test                     # hub smoke (3 pub / 1 sub, survives drop)
(cd common && uv run pytest)                     # Python schema conformance
(cd contracts && forge test)                     # 17 contract paths
(cd bridge && cargo test)                        # topic0 cross-check + ring decode/filter
```
