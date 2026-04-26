import { useEffect, useRef } from "react";
import { getToken } from "./api";

export type DocsEvent =
  | { type: "hello"; user?: any }
  | { type: "doc:created"; doc: any }
  | { type: "doc:updated"; doc: any }
  | { type: "doc:deleted"; id: string; admin_id?: string; client_id?: string }
  | { type: "client:registered"; client: any }
  | { type: "connection:created"; peer: any }
  | { type: "connection:removed"; peer_id: string };

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

function makeWsUrl(token: string) {
  if (BASE) return BASE.replace(/^http/, "ws") + "/api/ws?token=" + encodeURIComponent(token);
  if (typeof window !== "undefined" && (window as any).location?.host) {
    const proto = (window as any).location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${(window as any).location.host}/api/ws?token=${encodeURIComponent(token)}`;
  }
  return "";
}

export function useDocsSocket(onEvent: (e: DocsEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let timer: any = null;

    const connect = async () => {
      if (stopped) return;
      const token = await getToken();
      if (!token) { schedule(); return; }
      const url = makeWsUrl(token);
      if (!url) return;
      try { ws = new WebSocket(url); } catch { schedule(); return; }
      ws.onopen = () => { retry = 0; };
      ws.onmessage = (m: any) => {
        try { handlerRef.current(JSON.parse(m.data)); } catch { /* ignore */ }
      };
      ws.onclose = () => schedule();
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };

    const schedule = () => {
      if (stopped) return;
      retry = Math.min(retry + 1, 6);
      const delay = Math.min(500 * 2 ** retry, 8000);
      timer = setTimeout(connect, delay);
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, []);
}
