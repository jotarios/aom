//! 1C.5 / T7 — filter-topic0 cross-check. Asserts the bridge's hardcoded
//! TaskFunded topic0 equals keccak256 of the deployed contract's canonical event
//! signature. If the event params ever drift, this fails at test time instead of
//! the sidecar silently matching nothing live (a bug replay mode would otherwise hide).

use sha3::{Digest, Keccak256};

/// Must match the default in `main.rs` and `shared/abi/events.json`.
const TASK_FUNDED_TOPIC0: &str = "0xd4395f843b34deb19912041a8f197eb7dd4e9da92a83cafcd9669f20e08aab15";

/// Canonical signature of AgentEscrow's TaskFunded event.
const TASK_FUNDED_SIG: &str = "TaskFunded(bytes32,address,uint256,bytes32)";

fn keccak256_hex(s: &str) -> String {
    let mut hasher = Keccak256::new();
    hasher.update(s.as_bytes());
    let out = hasher.finalize();
    format!("0x{}", hex::encode(out))
}

#[test]
fn topic0_matches_event_signature() {
    let computed = keccak256_hex(TASK_FUNDED_SIG);
    assert_eq!(
        computed, TASK_FUNDED_TOPIC0,
        "TaskFunded topic0 drift: signature changed but the bridge filter wasn't updated"
    );
}
