//! 3.2 / 3.3 — ring rail mode coverage.
//! Verifies the snapshot REPLAY reader runs the real decode/filter/latency path:
//!  - filters by contract address + TaskFunded topic0 (drops foreign events)
//!  - emits a sub-ms ring intercept-delta per matching captured event
//! The shadow-ring (mode-b) path is exercised by the live integrated E2E; the
//! pure-replay path is covered here without a live node (any OS).

use std::path::Path;

// Re-declare the modules the bridge binary uses (integration tests compile separately).
#[path = "../src/event.rs"]
mod event;
#[path = "../src/ring_rail.rs"]
mod ring_rail;

use event::{Phase, Rail};
use ring_rail::{CapturedEvent, RingRail};
use tokio::sync::mpsc;

const CONTRACT: &str = "0xc03b55fbcee7766b60d33a82c66615620c9e2f1e";
const TOPIC0: &str = "0xd4395f843b34deb19912041a8f197eb7dd4e9da92a83cafcd9669f20e08aab15";

fn cap(task: &str, addr: &str, topic0: &str, offset: u64) -> CapturedEvent {
    CapturedEvent {
        task_id: task.to_string(),
        address: addr.to_string(),
        topic0: topic0.to_string(),
        block_number: 100,
        onchain_ts_ms: 1_000_000.0,
        offset_ms: offset,
    }
}

#[tokio::test]
async fn replay_filters_and_emits_ring_intercepts() {
    let rows = vec![
        cap("0x01", CONTRACT, TOPIC0, 0),
        // foreign contract — must be dropped
        cap("0x02", "0xdeadbeef00000000000000000000000000000000", TOPIC0, 0),
        // wrong topic0 — must be dropped
        cap("0x03", CONTRACT, "0x0000000000000000000000000000000000000000000000000000000000000000", 0),
        cap("0x04", CONTRACT, TOPIC0, 0),
    ];
    let (tx, mut rx) = mpsc::channel(16);
    let ring = RingRail::new(CONTRACT.to_string(), TOPIC0.to_string());
    tokio::spawn(async move { ring.run_replay(rows, tx).await });

    let mut got = Vec::new();
    while let Some(ev) = rx.recv().await {
        got.push(ev);
    }
    // Only the two well-formed matches survive the filter.
    assert_eq!(got.len(), 2, "filter should drop foreign-contract + wrong-topic rows");
    for ev in &got {
        assert!(matches!(ev.phase, Phase::Intercept));
        assert!(matches!(ev.rail, Some(Rail::Ring)));
        let lat = ev.latency_ms.unwrap();
        assert!(lat >= 0.0 && lat < 5.0, "ring intercept-delta should be sub-ms-ish, got {lat}");
    }
}

#[test]
fn sample_capture_exists_for_replay_mode() {
    // The pure-replay (standalone ring) demonstration ships a sample capture.
    assert!(Path::new("../data/snapshot/capture.sample.json").exists(), "sample capture present");
}
