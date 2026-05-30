// Node-only scenario loading. Imported by agents/tools, NEVER by the browser UI
// (the UI uses validateScenario + a Vite glob import instead).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateScenario, type Scenario } from "./scenario.js";

const SCENARIOS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scenarios");

function fail(reason: string): never {
  throw new Error(`invalid scenario config: ${reason}`);
}

/** Load + validate a scenario by id from scenarios/<id>.json. */
export function loadScenario(id: string): Scenario {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) fail(`unsafe scenario id: ${id}`);
  let raw: string;
  try {
    raw = readFileSync(join(SCENARIOS_DIR, `${id}.json`), "utf8");
  } catch {
    fail(`scenario file not found: ${id}.json`);
  }
  const parsed: unknown = JSON.parse(raw);
  const scenario = validateScenario(parsed);
  if (scenario.id !== id) fail(`id mismatch: file says ${scenario.id}, requested ${id}`);
  return scenario;
}

/** Resolve the active scenario id from SCENARIO env, defaulting to "toll". */
export function activeScenarioId(): string {
  return process.env.SCENARIO?.trim() || "toll";
}
