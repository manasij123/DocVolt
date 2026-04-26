import { useEffect, useRef } from "react";

/**
 * useDocsSocket — connects to the backend's WebSocket channel under /api/ws
 * Works in React-Native (mobile + Expo Web) using the WHATWG WebSocket API.
 * Auto-reconnects on disconnect with exponential backoff.
 */
export type DocsEvent =
  | { type: "hello" }
  | { type: "doc:created"; doc: any }
  | { type: "doc:updated"; doc: any }
  | { type: "doc:deleted"; id: string };

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

function wsUrl() {
  // BASE looks like "https://host" — convert to "wss://host/api/ws"
  if (BASE) {
    return BASE.replace(/^http/, "ws") + "/api/ws";
  }
  // Fallback for Expo web preview when BASE isn't set: use current origin
  if (typeof window !== "undefined" && window.location?.host) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/ws`;
  }
  return "";
}

export function useDocsSocket(onEvent: (e: DocsEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const url = wsUrl();
    if (!url) return;

    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let reconnectTimer: any = null;

    const connect = () => {
      if (stopped) return;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => { retry = 0; };
      ws.onmessage = (m: any) => {
        try {
          const data = JSON.parse(m.data);
          handlerRef.current(data);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => scheduleReconnect();
      ws.onerror = () => {
        try { ws?.close(); } catch { /* noop */ }
      };
    };
    const scheduleReconnect = () => {
      if (stopped) return;
      retry = Math.min(retry + 1, 6);
      const delay = Math.min(500 * 2 ** retry, 8000);
      reconnectTimer = setTimeout(connect, delay);
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, []);
}
