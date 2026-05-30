//! AOM Bridge — the dual-rail sidecar.
//!
//! - rpc rail: a real eth_getLogs poll @250ms against the deployed contract.
//! - ring rail: a snapshot REPLAY reader (Phase 2) running the real decode/filter
//!   path; Phase 3 swaps in the live monad-exec-events SDK behind `--features sdk`.
//!
//! Both rails publish `INTERCEPT` events to the standalone WS hub. The bridge has
//! zero scenario coupling — it only filters our contract address + TaskFunded topic0.

mod event;
mod hub;
mod ring_rail;
mod rpc_rail;

use std::path::Path;

use tokio::sync::mpsc;

use crate::hub::HubPublisher;
use crate::ring_rail::{CapturedEvent, RingRail};
use crate::rpc_rail::RpcRail;

fn env(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into())).init();

    let rpc_url = env("MONAD_TESTNET_RPC", "https://testnet-rpc.monad.xyz");
    let hub_url = env("HUB_URL", "ws://localhost:8787");
    let contract = env("ESCROW_ADDRESS", "");
    // TaskFunded(bytes32,address,uint256,bytes32) topic0 — matches shared/abi/events.json.
    let topic0 = env("TASK_FUNDED_TOPIC0", "0xd4395f843b34deb19912041a8f197eb7dd4e9da92a83cafcd9669f20e08aab15");

    if contract.is_empty() {
        tracing::warn!("ESCROW_ADDRESS not set — rpc rail will match nothing");
    }
    tracing::info!(%contract, %rpc_url, %hub_url, "bridge starting");

    let (tx, mut rx) = mpsc::channel::<event::AomEvent>(256);

    // ring rail source. If a real snapshot capture is present we replay it (decoupled
    // taskIds). Otherwise the rpc rail shadow-emits a ring intercept per live lock so
    // the integrated demo is driven by the real on-chain lock (mode-b).
    let capture_path = env("RING_CAPTURE", "data/snapshot/capture.json");
    let have_capture = Path::new(&capture_path).exists();
    // SHADOW_RING=0 disables; default on when there's no real capture to drive the ring.
    let shadow_ring = env("SHADOW_RING", if have_capture { "0" } else { "1" }) == "1";

    // rpc rail (always live)
    {
        let tx = tx.clone();
        let rpc = RpcRail::new(rpc_url.clone(), contract.clone(), topic0.clone(), shadow_ring);
        tokio::spawn(async move { rpc.run(tx).await });
    }
    tracing::info!(shadow_ring, have_capture, "rail configuration");

    // ring rail (Phase 2 replay if a capture is present; Phase 3 live via --features sdk)
    if have_capture {
        let tx = tx.clone();
        let ring = RingRail::new(contract.clone(), topic0.clone());
        match std::fs::read_to_string(&capture_path) {
            Ok(raw) => match serde_json::from_str::<Vec<CapturedEvent>>(&raw) {
                Ok(captured) => {
                    tracing::info!(count = captured.len(), "ring rail: replaying snapshot capture");
                    tokio::spawn(async move { ring.run_replay(captured, tx).await });
                }
                Err(e) => tracing::error!("ring capture parse error: {e}"),
            },
            Err(e) => tracing::error!("ring capture read error: {e}"),
        }
    } else {
        tracing::info!("no ring capture at {capture_path} — ring rail driven by rpc shadow (mode-b)");
    }

    // Publish loop
    let mut publisher = HubPublisher::connect(&hub_url).await?;
    tracing::info!("connected to hub");
    while let Some(ev) = rx.recv().await {
        if let Err(e) = publisher.publish(&ev).await {
            tracing::error!("publish failed: {e} — reconnecting");
            match HubPublisher::connect(&hub_url).await {
                Ok(p) => publisher = p,
                Err(e2) => tracing::error!("reconnect failed: {e2}"),
            }
        }
    }
    Ok(())
}
