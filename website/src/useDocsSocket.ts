import { useEffect, useRef } from "react";

/**
 * useDocsSocket — connects to the backend's WebSocket channel under /api/ws
 * and runs the supplied handler whenever the server announces that any
 * document was created / updated / deleted. Auto-reconnects on disconnect.
 */
export type DocsEvent =
  | { type: "hello" }
  | { type: "doc:created"; doc: any }
  | { type: "doc:updated"; doc: any }
  | { type: "doc:deleted"; id: string };

export function useDocsSocket(onEvent: (e: DocsEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;

    const wsUrl = () => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${window.location.host}/api/ws`;
    };

    const connect = () => {
      if (stopped) return;
      try {
        ws = new WebSocket(wsUrl());
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        retry = 0;
      };
      ws.onmessage = (m) => {
        try {
          const data = JSON.parse(m.data);
          handlerRef.current(data);
        } catch {
          /* ignore malformed payloads */
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
      setTimeout(connect, delay);
    };

    connect();
    return () => {
      stopped = true;
      try { ws?.close(); } catch { /* noop */ }
    };
  }, []);
}
