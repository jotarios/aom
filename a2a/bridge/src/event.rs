//! Mirror of schema/schema.json — the event-stream contract.
//! Keep field names/enums in lockstep with schema.json, the TS mirror, and the pydantic model.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Phase {
    #[serde(rename = "INTENT")]
    Intent,
    #[serde(rename = "ESCROW_LOCK")]
    EscrowLock,
    #[serde(rename = "INTERCEPT")]
    Intercept,
    #[serde(rename = "PIPELINE")]
    Pipeline,
    #[serde(rename = "SETTLEMENT")]
    Settlement,
    #[serde(rename = "REVERTED")]
    Reverted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Rail {
    #[serde(rename = "ring")]
    Ring,
    #[serde(rename = "rpc")]
    Rpc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Status {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "computing")]
    Computing,
    #[serde(rename = "settled")]
    Settled,
    #[serde(rename = "reverted")]
    Reverted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AomEvent {
    pub phase: Phase,
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub status: Status,
    pub msg: String,
    #[serde(default)]
    pub rail: Option<Rail>,
    #[serde(rename = "latencyMs", default)]
    pub latency_ms: Option<f64>,
    #[serde(rename = "reportHash", default)]
    pub report_hash: Option<String>,
    #[serde(rename = "txHash", default)]
    pub tx_hash: Option<String>,
    #[serde(rename = "walletId", default)]
    pub wallet_id: Option<String>,
    #[serde(rename = "resourceId", default)]
    pub resource_id: Option<String>,
    #[serde(rename = "blockNumber", default)]
    pub block_number: Option<u64>,
    #[serde(default)]
    pub ts: Option<f64>,
}

impl AomEvent {
    /// Build an INTERCEPT observation for one rail.
    pub fn intercept(task_id: String, rail: Rail, latency_ms: f64, block_number: Option<u64>, msg: &str) -> Self {
        AomEvent {
            phase: Phase::Intercept,
            task_id,
            status: Status::Computing,
            msg: msg.to_string(),
            rail: Some(rail),
            latency_ms: Some(latency_ms),
            report_hash: None,
            tx_hash: None,
            wallet_id: None,
            resource_id: None,
            block_number,
            ts: None,
        }
    }
}
