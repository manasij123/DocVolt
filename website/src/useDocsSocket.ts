import { useEffect, useRef } from "react";
import { getToken } from "./api";

export type DocsEvent =
  | { type: "hello"; user?: any }
  | { type: "doc:created"; doc: any }
  | { type: "doc:updated"; doc: any }
  | { type: "doc:deleted"; id: string; admin_id?: string; client_id?: string }
  | { type: "client:registered"; client: any };

export function useDocsSocket(onEvent: (e: DocsEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;

    const wsUrl = () => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const token = getToken();
      const q = token ? `?token=${encodeURIComponent(token)}` : "";
      return `${proto}//${window.location.host}/api/ws${q}`;
    };

    const connect = () => {
      if (stopped) return;
      if (!getToken()) { scheduleReconnect(); return; }
      try { ws = new WebSocket(wsUrl()); } catch { scheduleReconnect(); return; }
      ws.onopen = () => { retry = 0; };
      ws.onmessage = (m) => {
        try { handlerRef.current(JSON.parse(m.data)); } catch { /* ignore */ }
      };
      ws.onclose = () => scheduleReconnect();
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      retry = Math.min(retry + 1, 6);
      const delay = Math.min(500 * 2 ** retry, 8000);
      setTimeout(connect, delay);
    };

    connect();
    return () => { stopped = true; try { ws?.close(); } catch { /* noop */ } };
  }, []);
}
