import { useEffect, useState } from "react";
import { useDocsSocket, DocsEvent } from "./useDocsSocket";
import { getToken } from "./api";

export default function LiveBadge() {
  const [connected, setConnected] = useState(false);
  useDocsSocket((e: DocsEvent) => { if (e.type === "hello") setConnected(true); });

  useEffect(() => {
    if (!getToken()) { setConnected(false); }
  }, []);

  return (
    <span className={`live-pill ${connected ? "" : "off"}`} title={connected ? "Live" : "Offline"}>
      <span className="dot" />
      {connected ? "Live" : "Offline"}
    </span>
  );
}
