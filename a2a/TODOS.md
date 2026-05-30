# TODOS

## Race against `eth_subscribe` (WebSocket) as a stronger latency baseline

**What:** Add a third rail (or swap the rpc rail) that races the ring-buffer reader
against Monad's node WebSocket `eth_subscribe("logs")` — the actual fastest
non-sidecar option a real dev would reach for — not just a 250ms `eth_getLogs` poll.

**Why:** "We beat even WebSocket" is a stronger, more judge-proof claim than "we beat
polling." It directly closes the most likely sharp-judge challenge: "why a 250ms
poll? real systems use WS subscriptions." The ring buffer's margin over WS (still
network-bound) is the number a Monad engineer actually cares about.

**Pros:** Strongest honest latency claim; removes any "sandbagged the baseline"
critique; demonstrates understanding of the real alternatives.

**Cons:** Extra WS-subscribe code path to build and stamp latency on; not needed for
the sprint's core wow (the 250ms poll is an honest baseline); adds surface to a
1-day budget already carrying the snapshot-replay pivot.

**Context:** Surfaced by the eng-review outside voice (2026-05-30). The sprint plan
(design doc + `~/.claude/plans/wondrous-nibbling-pebble.md`) deliberately races the
250ms poll for now and shows the real latency distribution honestly. This TODO is the
post-sprint upgrade. The latency `t0` is the intercept-delta (event's on-chain
timestamp → reader sees it), so a WS rail measures WS-receipt against that same
reference.

**Depends on / blocked by:** The snapshot-replay ring read working first (that's the
fast rail being raced). Lower priority than shipping the core dual-rail demo.

## Wire the real `monad-exec-events` SDK reader (Phase 3 live ring rail)

**What:** Replace the bridge's replay/shadow ring rail with the genuine
`monad-exec-events` Rust Event Stream API reading the `hugetlbfs` ring buffer.
The swappable interface already exists: `bridge/src/ring_rail.rs::sdk::run_live`
(compiled with `--features sdk`) is the stub to fill, and it publishes the same
`rail:ring` `AomEvent` the replay reader does — no other component changes.

**Why deferred:** The SDK crate is not on crates.io (it lives in Monad's `monode`
/ SDK repos) and a live read requires a synced full node, which is bare-metal
Linux only (16c/32GB/2TB NVMe, Ubuntu 24.04, SMT off — not a Mac). The offline
snapshot capture artifact also wasn't available in this build environment.

**How to land:** On a Linux node host — (1) add the `monad-exec-events` git
dependency to `bridge/Cargo.toml` under the `sdk` feature, (2) implement
`run_live` adapting the `monode` reader to filter our contract address +
TaskFunded topic0 and emit `AomEvent::intercept(.., Rail::Ring, ..)`, (3) run
`cargo build --features sdk` and start the bridge with `RING_CAPTURE` unset and
`SHADOW_RING=0`. The `topic0_crosscheck` test guards the filter; `ring_modes`
covers the decode/filter contract the live reader must also satisfy.

**Demo-day fallback (already shipped):** mode-b (rpc shadow-emits `rail:ring` per
live lock) and pure-replay (`RING_CAPTURE=data/snapshot/capture.sample.json`) both
work today on any OS — narrate the asterisk: "the reader is real; it replays a
capture / shadows the live lock here, and runs live on a Linux node."
