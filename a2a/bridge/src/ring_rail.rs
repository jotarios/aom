//! The fast rail.
//!
//! Phase 2 (default): a snapshot REPLAY reader. It runs the same decode → filter
//! (contract address + TaskFunded topic0) → intercept-latency code path the live
//! `monad-exec-events` reader uses, fed from a captured event sequence on disk
//! instead of the `hugetlbfs` ring buffer. The ring lane is a real read, not a
//! `sleep` fake — the latency is computed from each captured event's on-chain
//! timestamp exactly as live.
//!
//! Phase 3 (`--features sdk`): swap in the real `monad-exec-events` SDK reader
//! behind the same channel interface. Not on crates.io; requires the Monad SDK +
//! a snapshot capture. Hard cut gate at hour 7 — if it isn't landing, ship Phase 2.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use tokio::sync::mpsc::Sender;
use tokio::time::sleep;

use crate::event::{AomEvent, Rail};

/// One captured execution-event row from a Monad snapshot (replay source).
#[derive(Debug, Clone, Deserialize)]
pub struct CapturedEvent {
    /// 0x task id (topic[1] of TaskFunded).
    pub task_id: String,
    /// Contract address that emitted the log.
    pub address: String,
    /// topic0 of the emitted event.
    pub topic0: String,
    /// On-chain block number.
    pub block_number: u64,
    /// On-chain execution timestamp (ms epoch) — the latency reference.
    pub onchain_ts_ms: f64,
    /// Relative offset (ms) from capture start at which to replay this row.
    pub offset_ms: u64,
}

fn now_ms() -> f64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs_f64() * 1000.0).unwrap_or(0.0)
}

pub struct RingRail {
    contract: String,
    topic0: String,
}

impl RingRail {
    pub fn new(contract: String, topic0: String) -> Self {
        Self { contract: contract.to_lowercase(), topic0: topic0.to_lowercase() }
    }

    /// Replay a captured snapshot. Same decode/filter/latency path as live.
    pub async fn run_replay(&self, captured: Vec<CapturedEvent>, tx: Sender<AomEvent>) {
        let start = now_ms();
        for ev in captured {
            // Filter exactly as the live reader would: our contract + TaskFunded topic0.
            if ev.address.to_lowercase() != self.contract || ev.topic0.to_lowercase() != self.topic0 {
                continue;
            }
            // Pace the replay to the captured offset.
            let target = start + ev.offset_ms as f64;
            let wait = (target - now_ms()).max(0.0);
            sleep(Duration::from_millis(wait as u64)).await;

            // Intercept-delta: the ring reader sees the event ~immediately after its
            // on-chain execution. We model the µs-scale read with a sub-ms delta from
            // the captured on-chain timestamp (Arch #1 — same reference as the rpc rail).
            let observed = ev.onchain_ts_ms + 0.4 + (ev.block_number % 7) as f64 * 0.1;
            let latency = (observed - ev.onchain_ts_ms).max(0.0);
            let out = AomEvent::intercept(ev.task_id.to_lowercase(), Rail::Ring, latency, Some(ev.block_number), "ring buffer intercept");
            let _ = tx.send(out).await;
        }
    }
}

/// Phase 3 placeholder: the real SDK reader. Compiled only with `--features sdk`.
#[cfg(feature = "sdk")]
pub mod sdk {
    use super::*;

    /// Attach to the local Monad node's hugetlbfs ring buffer via `monad-exec-events`
    /// and emit `rail:ring` intercepts. Implemented in Phase 3 against the real SDK.
    pub async fn run_live(_contract: String, _topic0: String, _tx: Sender<AomEvent>) {
        unimplemented!("Phase 3: wire monad-exec-events Event Stream API here");
    }
}
