import { useEffect, useRef, useState, useCallback } from "react";
import { validateEvent, type AomEvent } from "@aom/shared";

export type HubStatus = "connecting" | "open" | "reconnecting";

const HUB_URL = (import.meta.env.VITE_HUB_URL as string | undefined) ?? "ws://localhost:8787";

// Subscribe to the broadcast hub with auto-reconnect + backoff (1D.6). The hub is
// the SPOF for all rail modes, so the UI must survive a drop and show "reconnecting".
export function useHub(onEvent: (e: AomEvent) => void): { status: HubStatus; sendTrigger: () => void } {
  const [status, setStatus] = useState<HubStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const backoffRef = useRef(500);
  const closedRef = useRef(false);

  const connect = useCallback(() => {
    const ws = new WebSocket(HUB_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 500;
      setStatus("open");
    };
    ws.onmessage = (ev) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data as string);
      } catch {
        return; // malformed — ignore, don't blank the screen
      }
      const r = validateEvent(parsed);
      if (r.ok) onEventRef.current(r.event);
    };
    ws.onclose = () => {
      if (closedRef.current) return;
      setStatus("reconnecting");
      const delay = Math.min(backoffRef.current, 5000);
      backoffRef.current = Math.min(backoffRef.current * 2, 5000);
      setTimeout(connect, delay);
    };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    closedRef.current = false;
    connect();
    return () => {
      closedRef.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  const sendTrigger = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "trigger" }));
    }
  }, []);

  return { status, sendTrigger };
}
