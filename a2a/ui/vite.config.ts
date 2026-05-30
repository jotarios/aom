import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { readFileSync } from "node:fs";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(root, "..");

// Read addresses from the repo .env (unprefixed) and expose only the public ones
// to the browser as import.meta.env.VITE_*. Never expose private keys.
function publicAddresses(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(repoRoot, ".env"), "utf8");
    const pick: Record<string, string> = {
      AGENT_A_ADDRESS: "VITE_AGENT_A_ADDRESS",
      AGENT_B_ADDRESS: "VITE_AGENT_B_ADDRESS",
      ESCROW_ADDRESS: "VITE_ESCROW_ADDRESS",
    };
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, v] = [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)];
      if (pick[k] && v) out[`import.meta.env.${pick[k]}`] = JSON.stringify(v);
    }
  } catch {
    /* .env optional */
  }
  return out;
}

// Serve the repo-root scenarios/ + data/ as static so the browser can fetch the
// active scenario config (the same JSON the Node/Python loaders validate).
export default defineConfig({
  plugins: [react()],
  define: publicAddresses(),
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
  resolve: {
    alias: {
      "@scenarios": resolve(repoRoot, "scenarios"),
    },
  },
});
