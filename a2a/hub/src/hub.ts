// Standalone WS relay. Broadcast-only, NO per-client state. Everything publishes
// here; the UI subscribes. The single integration point — keep it dumb so it
// can't wedge. (Arch #2, Failure Modes CRITICAL GAP: hub is the SPOF.)

import { WebSocketServer, WebSocket } from "ws";
import { validateEvent } from "@aom/shared";

function isControl(v: unknown): boolean {
  return typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).type === "string";
}

export function startHub(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  const broadcast = (raw: string, except: WebSocket): void => {
    for (const client of wss.clients) {
      if (client !== except && client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  };

  wss.on("connection", (socket) => {
    socket.on("message", (data) => {
      const raw = data.toString();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return; // ignore non-JSON
      }
      // Control messages (e.g. the UI's `trigger`) relay verbatim. Event
      // messages must validate against the contract or they're dropped.
      if (isControl(parsed)) {
        broadcast(raw, socket);
        return;
      }
      const r = validateEvent(parsed);
      if (!r.ok) {
        console.warn(`[hub] dropped invalid event: ${r.error}`);
        return;
      }
      broadcast(raw, socket);
    });
    socket.on("error", () => {
      /* per-client errors are non-fatal; broadcast-only hub holds no client state */
    });
  });

  wss.on("listening", () => {
    console.log(`[hub] broadcast relay listening on ws://localhost:${port}`);
  });

  return wss;
}

// CLI entry — only when run directly.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.HUB_PORT ?? 8787);
  const wss = startHub(port);
  process.on("SIGINT", () => wss.close(() => process.exit(0)));
}
