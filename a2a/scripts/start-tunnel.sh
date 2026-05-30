#!/usr/bin/env bash
# Expose the AOM hub via a Cloudflare Tunnel and optionally deploy the UI to Vercel.
#
#   ./scripts/start-tunnel.sh             # tunnel only, dev UI on localhost:5173
#   ./scripts/start-tunnel.sh --vercel    # tunnel + Vercel preview deploy
#   ./scripts/start-tunnel.sh --vercel --prod   # tunnel + Vercel production deploy
#
# If the hub is already running (e.g. via run-demo.sh), it is reused.
# Ctrl-C stops the tunnel (and the hub if this script started it).
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; [ -f .env ] && source .env; set +a

DEPLOY_VERCEL=0
VERCEL_PROD=0
for arg in "$@"; do
  case "$arg" in
    --vercel) DEPLOY_VERCEL=1 ;;
    --prod)   VERCEL_PROD=1 ;;
  esac
done

# Prerequisites
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[tunnel] cloudflared not found -- install: brew install cloudflare/cloudflare/cloudflared"
  exit 1
fi
if [ "$DEPLOY_VERCEL" = "1" ] && ! command -v vercel >/dev/null 2>&1; then
  echo "[tunnel] vercel CLI not found -- install: pnpm add -g vercel"
  exit 1
fi

HUB_PORT="${HUB_PORT:-8787}"

pids=()
cleanup() {
  echo
  echo "[tunnel] stopping..."
  for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

# Start hub only if port is not already in use
if lsof -ti ":$HUB_PORT" >/dev/null 2>&1; then
  echo "[tunnel] hub already running on :$HUB_PORT -- reusing"
else
  echo "[tunnel] starting hub on :$HUB_PORT..."
  ( cd hub && node --import tsx src/hub.ts ) & pids+=($!)
  sleep 1.5
fi

# Start cloudflared and capture tunnel URL
TUNNEL_LOG=$(mktemp)
cloudflared tunnel --url "localhost:$HUB_PORT" --no-autoupdate 2>"$TUNNEL_LOG" &
pids+=($!)

echo "[tunnel] waiting for tunnel URL..."
TUNNEL_URL=""
for i in $(seq 1 30); do
  TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)
  [ -n "$TUNNEL_URL" ] && break
  sleep 1
done
rm -f "$TUNNEL_LOG"

if [ -z "$TUNNEL_URL" ]; then
  echo "[tunnel] ERROR: no tunnel URL after 30s"
  exit 1
fi

# Cloudflare terminates TLS, so WebSocket clients use wss://
HUB_WSS="${TUNNEL_URL/https:\/\//wss://}"

echo ""
echo "===================================================="
echo "  Tunnel URL : $TUNNEL_URL"
echo "  Hub WS URL : $HUB_WSS"
echo "===================================================="
echo ""

if [ "$DEPLOY_VERCEL" = "1" ]; then
  echo "[tunnel] building UI..."
  ( cd ui && VITE_HUB_URL="$HUB_WSS" \
      VITE_AGENT_A_ADDRESS="${AGENT_A_ADDRESS:-}" \
      VITE_AGENT_B_ADDRESS="${AGENT_B_ADDRESS:-}" \
      VITE_ESCROW_ADDRESS="${ESCROW_ADDRESS:-}" \
      pnpm build )

  VERCEL_ARGS=()
  [ "$VERCEL_PROD" = "1" ] && VERCEL_ARGS+=(--prod)

  echo "[tunnel] deploying to Vercel..."
  DEPLOY_URL=$(cd ui && vercel "${VERCEL_ARGS[@]}" \
    --env VITE_HUB_URL="$HUB_WSS" \
    --yes 2>&1 | grep -E 'https://.*\.vercel\.app' | tail -1 || true)

  if [ -n "$DEPLOY_URL" ]; then
    echo "  Vercel URL : $DEPLOY_URL"
    echo ""
  else
    echo "[tunnel] could not parse Vercel deploy URL -- check output above"
  fi
else
  echo "[tunnel] to connect the UI, use:"
  echo "  VITE_HUB_URL=$HUB_WSS SCENARIO=\${SCENARIO:-toll} ./scripts/run-demo.sh"
  echo ""
  echo "  or just the UI dev server:"
  echo "  cd ui && VITE_HUB_URL=$HUB_WSS pnpm dev"
fi

echo "[tunnel] tunnel running -- Ctrl-C to stop"
wait
