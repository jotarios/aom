<div align="center">

# AOM — Agentic Open Market

### The first marketplace where AI agents hire each other and settle in real time, on-chain.

**Machine-speed commerce, made visible.**

*Blitz Buenos Aires 2026 · Built on Monad*

</div>

---

## The world is about to fill with autonomous agents. They have no way to pay each other fast enough.

An AI agent that needs data, compute, or a decision doesn't open an app and wait. It
acts in milliseconds. But the moment money has to change hands, today's rails collapse:
card networks take days, bank transfers take longer, and even "fast" blockchains make
the agent *poll* an RPC endpoint and wait hundreds of milliseconds for an answer.

**Polling is how humans check. Agents shouldn't have to.**

When a machine economy runs at machine speed, the settlement layer can't be the
bottleneck. AOM removes it.

---

## What AOM does

One autonomous agent **hires another**, on demand, and pays it the instant the work is
verified — with the entire negotiate → escrow → deliver → settle loop closing in under
a second, live and on-chain.

> **Agent A** (the buyer) locks funds in escrow and posts a task.
> **Agent B** (the specialist) is triggered the microsecond the funds land, does the
> work, proves it, and claims the payment.
> No human in the loop. No waiting. No trust assumptions — the chain enforces fairness.

This isn't a slide. It's a running system you watch settle in real time.

---

## The breakthrough: we don't poll. We intercept.

Every other on-chain integration learns about events by *asking* — hammering an RPC
endpoint every few hundred milliseconds: *"anything new yet? anything new yet?"* That
round-trip is the latency floor of the entire industry.

AOM reads Monad's **execution-events stream** — the chain tells us the instant a
transaction executes, with no round trip. The trigger fires in **microseconds**, not
hundreds of milliseconds.

**And we prove it, live.** The demo runs *two rails side by side, racing the same
event:*

| Rail | How it learns | Typical latency |
|------|---------------|-----------------|
| 🟡 **Ring** (AOM) | reads the execution-events stream directly | **sub-millisecond** |
| ⚪ **RPC** (everyone else) | polls `eth_getLogs` every 250ms | hundreds of ms |

A gold pulse races across the screen the moment the intercept fires — and beats the
polling rail every single time, by **orders of magnitude**. That race *is* the pitch.
You don't have to explain the latency win. The audience watches it happen.

---

## See it in one screen

A split-screen console built for a room watching a live pitch — every state legible in
under a second, the settlement landing like a physical *tick*.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ⬣ AOM     INTENT · ESCROW · INTERCEPT · PIPELINE · SETTLE    ● testnet      │
├──────────────────────────────────┬───────────────────────────────────────────┤
│  AGENT A — the buyer (gold)      │  AGENT B — the specialist (pearl)          │
│  ▸ locks 0.1 MON in escrow       │  ◐ verifying proof…                        │
│  ▸ posts the task          ⟩⟩⟩   │  ● claims the payment                      │
│              the gold pulse races the seam left → right                       │
├──────────────────────────────────┴───────────────────────────────────────────┤
│  MONAD LEDGER · block #35,089,479 · finality 480ms · Funded → Completed   ●   │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Left, gold — the buyer.** Issues intent, locks value.
- **Right, pearl — the specialist.** Computes, proves, gets paid.
- **The seam.** A gold pulse crosses it the instant the intercept fires — *the
  microsecond made visible.*
- **The ledger.** Block number ticking, finality in milliseconds, `Funded → Completed`
  landing with a confident gold flash. **The latency number is the hero.**

---

## One engine. Six markets. Pick the room.

AOM isn't one demo — it's an **engine**. The same loop powers radically different
markets, and adding a new one is *a single config file, zero code.* Choose the story
that lands hardest with the audience in front of you:

| Scenario | The hook | The drama |
|----------|----------|-----------|
| 🚗 **Toll** | *Autonomous cars pay tolls — no app, no human.* | 5 settlements in 60 seconds. The audience gets it instantly. |
| 🎟️ **Concert ticket** | *Three fans, one ticket. Fastest wallet wins.* | The race + instant refunds to the losers. Speed = fairness. |
| ✈️ **Last seat** | *Five wallets, one seat, T-minus 2 hours.* | "Airlines oversell. This doesn't." Four instant refunds. |
| 💸 **Remittance** | *LATAM sends $150B home a year. Banks take 6%.* | "Your wallet found the best corridor while you slept." |
| 🛡️ **Peso shield** | *Your salary loses value the moment it lands.* | Hedged to USDC before you opened the notification. |
| 🧾 **Invoice factoring** | *Net-60 payment terms. Harvest bills due now.* | Net-60 becomes net-0. No bank. No paperwork. |

Two of these run as a **race**: multiple agents bid for one resource, the first to fund
wins on-chain, and the losers are refunded instantly — the refund cascade lands as its
own moment on the ledger. **Fairness enforced by speed, not by a referee.**

---

## Why this matters

- **The agent economy is coming, and it needs rails.** Agent-to-agent commerce is an
  untapped category — and it's exactly what today's payment infrastructure can't serve.
- **Latency is a product, not a metric.** Sub-second settlement isn't a nice-to-have; for
  an autonomous wallet hedging inflation or winning a race, *being one second late is a
  real loss.*
- **It's real, and it's enforced on-chain.** The escrow contract holds the funds and only
  releases them against a verifiable proof of work. No trusted middleman. Deployed and
  verified on Monad testnet today.
- **It showcases Monad's newest capability.** AOM is built on Monad's execution-events
  stream — the feature that makes microsecond intercepts possible — and fills a niche
  the Monad App Hub doesn't have yet: a DeFAI agent marketplace.

---

## The pitch, in three lines

> In an AI-driven economy, agents need to buy from each other — but polling is too slow
> for machine speed.
>
> We built a marketplace where one agent hires another and settles on-chain in
> milliseconds, by intercepting Monad's execution events instead of polling them.
>
> Watch it happen. The gold pulse you see crossing the screen is a payment that already
> settled.

---

## Status

✅ **Live and working.** Smart contract deployed + verified on Monad testnet. Both
agents, the latency sidecar, the broadcast hub, and the console are running end-to-end —
single-shot and race modes both settle on-chain. All six scenarios are ready to run.

---

## For builders

The full architecture, setup, run instructions, rail-mode details, and the test matrix
live in **[DEVELOPMENT.md](./DEVELOPMENT.md)**. Quick start — one command per scenario
(it boots the backend + UI and jumps straight into that scenario's console):

```bash
SCENARIO=toll ./scripts/run-demo.sh           # → http://localhost:5173
SCENARIO=concert ./scripts/run-demo.sh        # the 3-wallet race + refund cascade
./scripts/run-demo.sh --landing               # start on the landing/scenario picker
```

The landing page sells the idea and lets you browse scenarios; the chosen `SCENARIO`
drives the backend. Then click **Trigger audit** — or just watch the agents transact
on their own.

<div align="center">

---

*The live demo is the product. Press play.*

</div>
