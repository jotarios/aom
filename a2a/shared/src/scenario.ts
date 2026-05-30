// Mirror of scenarios/scenarios.schema.json — the scenario config contract.
// Keep in lockstep with the pydantic mirror in agent-a / agent-b.
// Browser-safe: types + validateScenario only. Node fs-based loading lives in
// scenario-node.ts so the browser bundle never pulls in node:fs/path.

export type ScenarioMode = "single" | "race";
export type PanelKind = "keyvalue" | "table" | "balance";

export interface ScenarioStory {
  hook: string;
  agentA: string;
  agentB: string;
  outcome?: string;
  agentBRole?: string;
  icon?: string;
  agentADesc?: string;
  agentBDesc?: string;
}

export interface ScenarioAgentB {
  label: string;
  computeMs: number;
  panel: PanelKind;
  data: unknown;
}

export interface ScenarioProof {
  fields: string[];
}

export interface ScenarioRun {
  count: number;
  spacingMs: number;
}

export interface Scenario {
  id: string;
  mode: ScenarioMode;
  wallets: number;
  resourceId: string | null;
  amountMon: string;
  story: ScenarioStory;
  agentB: ScenarioAgentB;
  proof: ScenarioProof;
  run: ScenarioRun;
}

function fail(reason: string): never {
  throw new Error(`invalid scenario config: ${reason}`);
}

/** Validate a parsed JSON value as a Scenario, normalizing defaults. Fails fast. */
export function validateScenario(value: unknown): Scenario {
  if (typeof value !== "object" || value === null) fail("not an object");
  const v = value as Record<string, unknown>;

  if (typeof v.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(v.id)) fail(`bad id: ${String(v.id)}`);
  if (v.mode !== "single" && v.mode !== "race") fail(`bad mode: ${String(v.mode)}`);
  if (typeof v.wallets !== "number" || !Number.isInteger(v.wallets) || v.wallets < 1) fail("bad wallets");
  if (v.mode === "race" && v.wallets < 2) fail("race mode requires wallets >= 2");
  if (!(v.resourceId === null || v.resourceId === undefined || typeof v.resourceId === "string")) fail("bad resourceId");
  if (v.mode === "race" && (v.resourceId === null || v.resourceId === undefined)) fail("race mode requires resourceId");

  const story = v.story as Record<string, unknown> | undefined;
  if (!story || typeof story.hook !== "string" || typeof story.agentA !== "string" || typeof story.agentB !== "string") {
    fail("bad story");
  }

  const agentB = v.agentB as Record<string, unknown> | undefined;
  if (!agentB || typeof agentB.label !== "string" || typeof agentB.computeMs !== "number") fail("bad agentB");
  if (agentB.panel !== "keyvalue" && agentB.panel !== "table" && agentB.panel !== "balance") fail("bad agentB.panel");

  const proof = v.proof as Record<string, unknown> | undefined;
  if (!proof || !Array.isArray(proof.fields) || proof.fields.length < 1 || !proof.fields.every((f) => typeof f === "string")) {
    fail("bad proof.fields");
  }

  const run = v.run as Record<string, unknown> | undefined;
  if (!run || typeof run.count !== "number" || typeof run.spacingMs !== "number") fail("bad run");

  return {
    id: v.id,
    mode: v.mode,
    wallets: v.wallets,
    resourceId: (v.resourceId ?? null) as string | null,
    amountMon: typeof v.amountMon === "string" ? v.amountMon : "0.1",
    story: {
      hook: story.hook as string,
      agentA: story.agentA as string,
      agentB: story.agentB as string,
      ...(typeof story.outcome === "string" ? { outcome: story.outcome } : {}),
      ...(typeof story.agentBRole === "string" ? { agentBRole: story.agentBRole } : {}),
      ...(typeof story.icon === "string" ? { icon: story.icon } : {}),
      ...(typeof story.agentADesc === "string" ? { agentADesc: story.agentADesc } : {}),
      ...(typeof story.agentBDesc === "string" ? { agentBDesc: story.agentBDesc } : {}),
    },
    agentB: {
      label: agentB.label as string,
      computeMs: agentB.computeMs as number,
      panel: agentB.panel,
      data: agentB.data,
    },
    proof: { fields: proof.fields as string[] },
    run: { count: run.count as number, spacingMs: run.spacingMs as number },
  };
}

