Requirements Document (PRD): Agentic Open Market (AOM)

## Spatial-AI Data Broker Edition (Blitz Hackathon)

### 1. Executive Summary

**Project Name:** Agentic Open Market (AOM) - Agro-Fi Spatial Broker
**Objective:** Build an ultra-low-latency, agent-to-agent marketplace on Monad. Prove that an autonomous macro-strategy AI can instantly hire a specialized data science agent to calculate complex geospatial crop metrics (NDVI) and settle the micro-payment on-chain.
**Hackathon Target:** Blitz Buenos Aires 2026.
**The "Wow" Factor:** Bypassing traditional JSON-RPC latency by reading the Monad Execution Events shared memory ring buffer to trigger an off-chain Python/FastAPI data science pipeline, settling on-chain in sub-second time.

---

### 2. System Architecture & Tech Stack

The architecture strictly separates heavy computational processing from high-speed Monad settlement.

#### Off-Chain Environment

* **Agent A (The Macro Buyer):** A Python-based autonomous script representing an agricultural insurance manager. It determines when to trigger an environmental audit based on market signals or dates.
* **Agent B (The Geospatial Engine):** A Dockerized Python/FastAPI environment optimized for heavy data pipelines. It ingests satellite telemetry, applies EPSG:4326 standard projections, and calculates vegetation indices to assess specific crop hectares (e.g., rice or soy).
* **The Bridge (Execution SDK Sidecar):** A high-performance message broker built in Rust using `tokio` and the `monad-exec-events` SDK. It reads the local Monad node's `hugetlbfs` shared memory ring buffer to intercept `TxnLog` events instantaneously.

#### On-Chain Environment (Monad Testnet)

* **Smart Contract (`AgentEscrow.sol`):** A Solidity escrow contract that holds Agent A's funds (e.g., 0.1 MON) and releases them to Agent B only when a verifiable cryptographic hash of the geospatial report is submitted.
* **Latency Target:** Sub-second execution and agent notification using Monad's speculative finality.

#### Prefence tech stack:

* Frontend: React 19 & TanStack & TanStack Query
* AI SDK: Vercel AI SDK
* Styling: Tailwind CSS
* Components: shadcn/ui
* Auth:	Clerk
* Database:	Supabase or Neon
* ORM: Drizzle
* AI: OpenAI / Anthropic / Gemini
* Jobs: Trigger.dev
* Email: Resend
* Deploy: Vercel

---

### 3. Core Agent Flow

1. **Intent Generation:** Agent A identifies a geographical bounding box (using local UTM zones) requiring drought verification.
2. **Escrow Lock:** Agent A executes a transaction calling `lockFunds(bytes32 taskId, address agentB)` on the Monad testnet.
3. **Microsecond Intercept:** The Monad daemon speculatively executes the transaction and writes the `TaskFunded` event to the memory ring. The Rust sidecar intercepts this event instantly.
4. **Pipeline Execution:** The sidecar fires a WebSocket trigger to Agent B's FastAPI endpoint.
5. **Geospatial Inference:** Agent B pulls the spatial data and calculates:
$NDVI = \frac{NIR - Red}{NIR + Red}$
It formats the results into a plot-by-plot health report.
6. **Instant Settlement:** Agent B hashes the report, submits the hash to `completeTask()` on Monad, and claims the escrowed funds. Agent A receives the verified data.

---

### 4. Technical Scope for 1-Day Sprint

To successfully deploy this within the Blitz timeframe, the team must adhere to strict constraints.

* **Mock the Satellite Data:** Do not attempt live API calls to Sentinel or Landsat during the hackathon. Pre-load a directory of `.tif` telemetry files for a specific agricultural zone and have Agent B's script pull from this local dataset.
* **Simplified Rust Sidecar:** Adapt the boilerplate from Monad's `monode` repository. The Rust process only needs to filter for one specific contract address and emit one WebSocket event to the Python backend.
* **Web UI:** Build a high-performance web UI that uses a split-screen view. The left side shows Agent A's internal logs, the right side shows Agent B processing the geospatial data, and the bottom shows the sub-second Monad block confirmation.

---

### 5. Pitch & Demonstration Strategy

The live demo is the product. Avoid standard slide decks.

* **The Hook:** "In an AI-driven economy, agents need to buy complex data from each other, but traditional RPC polling is too slow for machine-speed interaction. We built AOM."
* **The Action:** Run the split-screen terminal live. Have the audience watch Agent A request a hectare analysis, the Rust sidecar instantly trigger the FastAPI endpoint via shared memory, and Agent B execute the NDVI math to claim the Monad bounty in real-time.
* **The Closing:** Remind judges that this leverages Monad's absolute newest Execution Events SDK and fills an untapped niche (DeFAI/Agent Marketplaces) currently missing from the Monad App Hub.

---

### 6. Tooling: Monad Development Skill

For all on-chain work in this project, use the **`monad-development`** Claude skill. Invoke it whenever the task involves:

* Scaffolding or deploying the `AgentEscrow.sol` contract with Foundry (`forge script`, not `forge create`)
* Funding a testnet wallet via the agent faucet and persisting generated wallet credentials
* Verifying deployed contracts across Monad explorers (MonadVision, Socialscan, Monadscan)
* Wiring the React 19 / viem / wagmi frontend to Monad (import `monadTestnet` from `viem/chains`)

**Defaults the skill enforces (and this project follows):** Monad **testnet** (chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`), Foundry over Hardhat, `evm_version = "prague"` with Solidity `0.8.27+`, and contract verification after every deployment.

