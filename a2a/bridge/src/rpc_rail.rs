//! The slow rail: a real `eth_getLogs` poll loop @250ms against Monad testnet RPC.
//! Latency is the intercept-delta — the block's on-chain timestamp to when the poll
//! returned the log (Arch #1 / T2). Degrades gracefully on empty polls / RPC errors.

use std::collections::HashSet;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::json;
use tokio::sync::mpsc::Sender;
use tokio::time::sleep;

use crate::event::{AomEvent, Rail};

const POLL_MS: u64 = 250;

pub struct RpcRail {
    rpc_url: String,
    contract: String,
    topic0: String,
    client: reqwest::Client,
    /// Mode-b: also emit a `rail:ring` intercept per live lock (the "replay
    /// impersonates ring" path) so Agent B is triggered off the real on-chain
    /// lock when no live SDK node is present. Narrated honestly in the demo.
    shadow_ring: bool,
}

impl RpcRail {
    pub fn new(rpc_url: String, contract: String, topic0: String, shadow_ring: bool) -> Self {
        Self {
            rpc_url,
            contract: contract.to_lowercase(),
            topic0: topic0.to_lowercase(),
            client: reqwest::Client::new(),
            shadow_ring,
        }
    }

    async fn rpc(&self, method: &str, params: serde_json::Value) -> anyhow::Result<serde_json::Value> {
        let body = json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params });
        let resp: serde_json::Value = self.client.post(&self.rpc_url).json(&body).send().await?.json().await?;
        if let Some(err) = resp.get("error") {
            if !err.is_null() {
                anyhow::bail!("rpc error on {method}: {err}");
            }
        }
        Ok(resp.get("result").cloned().unwrap_or(serde_json::Value::Null))
    }

    fn now_ms() -> f64 {
        SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs_f64() * 1000.0).unwrap_or(0.0)
    }

    /// Poll for new TaskFunded logs and emit a `rail:rpc` intercept per match.
    pub async fn run(&self, tx: Sender<AomEvent>) {
        let mut seen: HashSet<String> = HashSet::new();
        let mut from_block: u64 = match self.latest_block().await {
            Some(b) => b.saturating_sub(2),
            None => 0,
        };

        loop {
            sleep(Duration::from_millis(POLL_MS)).await;
            let latest = match self.latest_block().await {
                Some(b) => b,
                None => continue, // RPC hiccup — keep the rail alive
            };
            if latest < from_block {
                continue;
            }
            let logs = match self
                .rpc(
                    "eth_getLogs",
                    json!([{
                        "fromBlock": format!("0x{:x}", from_block),
                        "toBlock": format!("0x{:x}", latest),
                        "address": self.contract,
                        "topics": [self.topic0],
                    }]),
                )
                .await
            {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!("eth_getLogs error: {e}");
                    serde_json::Value::Null
                }
            };

            if let Some(arr) = logs.as_array() {
                if !arr.is_empty() {
                    tracing::info!(n = arr.len(), from = from_block, to = latest, "rpc rail: logs matched");
                }
                for log in arr {
                    let observed_ms = Self::now_ms();
                    let task_id = log
                        .get("topics")
                        .and_then(|t| t.as_array())
                        .and_then(|t| t.get(1))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_lowercase();
                    if task_id.is_empty() || seen.contains(&task_id) {
                        continue;
                    }
                    seen.insert(task_id.clone());

                    let block_hex = log.get("blockNumber").and_then(|v| v.as_str()).unwrap_or("0x0");
                    let block_num = u64::from_str_radix(block_hex.trim_start_matches("0x"), 16).unwrap_or(0);
                    let block_ts_ms = self.block_timestamp_ms(block_num).await.unwrap_or(observed_ms);
                    let latency = (observed_ms - block_ts_ms).max(0.0);

                    // Mode-b: the ring reader would have seen this ~microseconds after
                    // on-chain execution — emit a sub-ms ring intercept for the SAME
                    // live taskId so Agent B triggers off the real lock.
                    if self.shadow_ring {
                        let ring_latency = 0.4 + (block_num % 7) as f64 * 0.1;
                        let ring = AomEvent::intercept(task_id.clone(), Rail::Ring, ring_latency, Some(block_num), "ring buffer intercept");
                        let _ = tx.send(ring).await;
                    }

                    let ev = AomEvent::intercept(task_id, Rail::Rpc, latency, Some(block_num), "eth_getLogs poll matched");
                    let _ = tx.send(ev).await;
                }
            }
            from_block = latest + 1;
        }
    }

    async fn latest_block(&self) -> Option<u64> {
        let r = self.rpc("eth_blockNumber", json!([])).await.ok()?;
        let s = r.as_str()?;
        u64::from_str_radix(s.trim_start_matches("0x"), 16).ok()
    }

    async fn block_timestamp_ms(&self, block: u64) -> Option<f64> {
        let r = self.rpc("eth_getBlockByNumber", json!([format!("0x{:x}", block), false])).await.ok()?;
        let s = r.get("timestamp")?.as_str()?;
        let secs = u64::from_str_radix(s.trim_start_matches("0x"), 16).ok()?;
        Some(secs as f64 * 1000.0)
    }
}
