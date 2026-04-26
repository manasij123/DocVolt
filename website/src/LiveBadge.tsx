import { useEffect, useState } from "react";
import { useDocsSocket, DocsEvent } from "./useDocsSocket";

/** Small live-status badge — shows whether the realtime channel is connected. */
export default function LiveBadge() {
  const [connected, setConnected] = useState(false);
  useDocsSocket((e: DocsEvent) => {
    if (e.type === "hello") setConnected(true);
  });

  // Heartbeat the badge as 'off' while waiting for hello
  useEffect(() => {
    if (connected) return;
    const t = setTimeout(() => setConnected(false), 1500);
    return () => clearTimeout(t);
  }, [connected]);

  return (
    <span className={`live-pill ${connected ? "" : "off"}`} title={connected ? "Live updates connected" : "Connecting…"}>
      <span className="dot" />
      {connected ? "Live" : "Offline"}
    </span>
  );
}
