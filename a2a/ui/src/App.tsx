import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { AomEvent } from "@aom/shared";
import { useAllScenarios, useScenario } from "./useScenario";
import { useHub } from "./useHub";
import { initialState, reduce, stalledTasks, type ConsoleState } from "./state";
import { TopBar } from "./components/TopBar";
import { AgentPanel } from "./components/AgentPanel";
import { Timeline } from "./components/Timeline";
import { Panel } from "./components/Panel";
import { Section } from "./components/Section";
import { Output } from "./components/Output";
import { SeamRace } from "./components/SeamRace";
import { Ledger } from "./components/Ledger";
import { StatusPill } from "./components/StatusPill";
import { Idle } from "./components/Idle";
import { Landing } from "./components/Landing";
import "./App.css";

const WATCHDOG_MS = 12_000;

// Three-state flow: landing → idle (scenario selected) → console (demo running)
type AppView = "landing" | "idle" | "console";

export function App() {
  const allScenarios = useAllScenarios();

  // If VITE_SCENARIO is set, skip the landing and go straight to idle.
  const envScenarioId = (import.meta.env.VITE_SCENARIO as string | undefined)?.trim() || "";
  const [selectedId, setSelectedId] = useState<string>(envScenarioId || "");
  const [view, setView] = useState<AppView>(envScenarioId ? "idle" : "landing");
  const viewRef = useRef<AppView>(view);
  const setViewSafe = (v: AppView) => {
    viewRef.current = v;
    setView(v);
  };

  const scenario = useScenario(selectedId || undefined);

  const [state, dispatch] = useReducer((s: ConsoleState, e: AomEvent) => reduce(s, e), initialState);
  const [now, setNow] = useState(() => Date.now());

  const { status: hubStatus, sendTrigger } = useHub((e) => {
    if (viewRef.current === "landing") return;
    setViewSafe("console");
    dispatch(e);
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const tasks = Object.values(state.tasks);
  const activeTask = tasks.length ? tasks[tasks.length - 1] ?? null : null;
  const activePhase = activeTask?.phase ?? null;
  const stalled = stalledTasks(state, WATCHDOG_MS, now);

  const aSettling =
    activeTask?.status === "settled" ||
    activeTask?.phase === "ESCROW_LOCK" ||
    activeTask?.phase === "INTENT";
  const bComputing =
    activeTask?.phase === "PIPELINE" || activeTask?.phase === "INTERCEPT";

  // Agent A's panel status. In RACE mode the latest task is often a losing bidder
  // (reverted) — but Agent A as a whole isn't failed: one of its bidders won and the
  // rest were refunded by design. Reflect the round outcome: settled if any task
  // settled, computing while any is in flight, else the active task's status.
  const agentAStatus = useMemo((): "settled" | "computing" | "reverted" | "pending" | null => {
    if (!activeTask) return null;
    if (scenario.mode !== "race") return activeTask.status;
    if (tasks.some((t) => t.status === "settled")) return "settled";
    if (tasks.some((t) => t.status === "computing")) return "computing";
    if (tasks.some((t) => t.status === "pending")) return "pending";
    return activeTask.status;
  }, [scenario.mode, tasks, activeTask]);

  const ringLat = activeTask?.rails.ring ?? null;
  const rpcLat = activeTask?.rails.rpc ?? null;

  const lastSettlement = useMemo(() => {
    for (let i = state.ledger.length - 1; i >= 0; i--) {
      if (state.ledger[i]!.kind === "settled") return state.ledger[i]!;
    }
    return null;
  }, [state.ledger]);

  const raceBidders = useMemo(() => {
    if (scenario.mode !== "race") return null;
    const byWallet = new Map<string, AomEvent | null>();
    for (const t of tasks) {
      if (t.walletId) byWallet.set(t.walletId, null);
    }
    return Array.from(byWallet.keys()).sort();
  }, [scenario.mode, tasks]);

  const onSelectScenario = (id: string) => {
    setSelectedId(id);
    setViewSafe("idle");
  };

  const onTrigger = () => {
    setViewSafe("console");
    sendTrigger();
  };

  // Landing: the pitch hero + scenario picker.
  if (view === "landing") {
    return <Landing scenarios={allScenarios} onSelect={onSelectScenario} />;
  }

  // Idle: scenario chosen, waiting to launch.
  if (view === "idle" && hubStatus !== "reconnecting") {
    return (
      <Idle
        scenario={scenario}
        onTrigger={onTrigger}
        onBack={() => setViewSafe("landing")}
      />
    );
  }

  // Console: demo running.
  return (
    <div className="app">
      <TopBar activePhase={activePhase} hubStatus={hubStatus} onHome={() => setViewSafe("landing")} />

      <main className="console">
        <div className="io-band">
          <Section label="Input" tone="input">
            <Panel kind={scenario.agentB.panel} data={scenario.agentB.data} />
          </Section>
          <Section label="Output" tone="output">
            <Output
              amountMon={scenario.amountMon}
              recipient={scenario.story.agentB}
              settlement={lastSettlement}
            />
          </Section>
        </div>

        <AgentPanel
          side="a"
          prefix={scenario.mode === "race" ? `Agent A · ${scenario.wallets} bidders` : "Agent A · the buyer"}
          name={scenario.story.agentA}
          {...(scenario.story.agentADesc ? { description: scenario.story.agentADesc } : {})}
          active={Boolean(aSettling)}
          statusDot={agentAStatus ? <StatusPill status={agentAStatus} /> : null}
          address={import.meta.env.VITE_AGENT_A_ADDRESS}
        >
          {raceBidders && raceBidders.length > 0 ? (
            <div className="race-rails">
              {raceBidders.map((w) => (
                <div className="race-rail" key={w}>
                  <span className="race-rail-label mono">{w}</span>
                </div>
              ))}
            </div>
          ) : null}
        </AgentPanel>

        <SeamRace lastSeam={state.lastSeam} />

        <AgentPanel
          side="b"
          prefix={scenario.story.agentBRole ? `Agent B · ${scenario.story.agentBRole}` : "Agent B · the specialist"}
          name={scenario.story.agentB}
          {...(scenario.story.agentBDesc ? { description: scenario.story.agentBDesc } : {})}
          active={Boolean(bComputing)}
          statusDot={bComputing ? <StatusPill status="computing" /> : null}
          address={import.meta.env.VITE_AGENT_B_ADDRESS}
        />

        <div className="tl-wrap">
          <Timeline
            task={activeTask}
            agentA={scenario.story.agentA}
            agentB={scenario.story.agentB}
            ringLatency={ringLat}
            rpcLatency={rpcLat}
          />
          {stalled.length > 0 ? (
            <div className="watchdog mono">◐ task not finalized, retrying…</div>
          ) : null}
        </div>

        <Ledger entries={state.ledger} latestBlock={state.latestBlock} />
      </main>

      <button className="floating-trigger cta cta--primary" onClick={onTrigger} type="button">
        Trigger audit
      </button>
    </div>
  );
}
