import { useMemo } from "react";
import { validateScenario, type Scenario } from "@aom/shared";

// Eagerly glob scenario JSONs at build time.
// The schema file is excluded — only <id>.json configs are scenarios.
const all = import.meta.glob<{ default: unknown }>("../../scenarios/*.json", { eager: true });
const modules = Object.fromEntries(Object.entries(all).filter(([k]) => !k.endsWith("scenarios.schema.json")));

function envId(): string {
  return (import.meta.env.VITE_SCENARIO as string | undefined)?.trim() || "";
}

/** All valid scenarios, sorted by id. */
export function useAllScenarios(): Scenario[] {
  return useMemo(() => {
    return Object.entries(modules)
      .map(([, mod]) => {
        try { return validateScenario(mod.default); } catch { return null; }
      })
      .filter((s): s is Scenario => s !== null)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, []);
}

/** Single scenario by id. Falls back to VITE_SCENARIO env, then first available. */
export function useScenario(id?: string): Scenario {
  const all_scenarios = useAllScenarios();
  return useMemo(() => {
    const target = id ?? envId();
    const found = target ? all_scenarios.find((s) => s.id === target) : all_scenarios[0];
    if (!found) throw new Error(`scenario not found: ${target || "(none)"}`);
    return found;
  }, [id, all_scenarios]);
}
