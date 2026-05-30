#!/usr/bin/env bash
# Boot the full AOM demo for ONE scenario: hub → bridge → Agent B → Agent A → UI.
#
#   SCENARIO=toll ./scripts/run-demo.sh            # toll (default)
#   SCENARIO=concert ./scripts/run-demo.sh         # the 3-wallet race + refunds
#   SCENARIO=flight-seat ./scripts/run-demo.sh     # 5-wallet race
#   (single: toll · remittance · peso-shield · invoice-factoring)
#
# The chosen SCENARIO drives the backend AND the UI (VITE_SCENARIO), so the UI
# boots straight into that scenario's console — the landing picker is bypassed.
# Pass --landing to start the UI on the landing page instead (picker is then
# illustrative; the backend still runs $SCENARIO).
#
# Ctrl-C stops everything.
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$HOME/.foundry/bin:$PATH"
set -a; [ -f .env ] && source .env; set +a
export SCENARIO="${SCENARIO:-toll}"

START_ON_LANDING=0
[ "${1:-}" = "--landing" ] && START_ON_LANDING=1

if [ ! -f "scenarios/${SCENARIO}.json" ]; then
  echo "[run-demo] ✗ unknown scenario '${SCENARIO}' — no scenarios/${SCENARIO}.json"; exit 1
fi

echo "════════════════════════════════════════════════════════"
echo "  AOM demo · SCENARIO=${SCENARIO}"
echo "  escrow=${ESCROW_ADDRESS:-unset}"
[ "$START_ON_LANDING" = "1" ] && echo "  UI: starts on the LANDING page" || echo "  UI: boots straight into the ${SCENARIO} console"
echo "════════════════════════════════════════════════════════"

pids=()
cleanup() { echo; echo "[run-demo] stopping…"; for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

( cd hub && node --import tsx src/hub.ts ) & pids+=($!)
sleep 1.5
( cd bridge && RUST_LOG=info ./target/debug/bridge ) & pids+=($!)
sleep 1.5
( cd agent-b && uv run --quiet python -m app.engine ) & pids+=($!)
sleep 2
( cd agent-a && uv run --quiet python -m aom_agent_a.main ) & pids+=($!)

# UI. VITE_SCENARIO pins the console to $SCENARIO (skips the landing) unless --landing.
UI_ENV=(VITE_AGENT_A_ADDRESS="${AGENT_A_ADDRESS:-}" VITE_AGENT_B_ADDRESS="${AGENT_B_ADDRESS:-}" VITE_ESCROW_ADDRESS="${ESCROW_ADDRESS:-}")
[ "$START_ON_LANDING" = "0" ] && UI_ENV+=(VITE_SCENARIO="$SCENARIO")
( cd ui && env "${UI_ENV[@]}" pnpm dev ) & pids+=($!)

echo "[run-demo] all up → http://localhost:5173"
wait
