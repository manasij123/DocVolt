/**
 * ToastSocketBridge — wires the global WebSocket events to the Toast system.
 *
 * Mounted once at the app root (inside ToastProvider). It subscribes to
 * `useDocsSocket` and emits a friendly toast for each push notification:
 *   - doc:created      → "📄 New document uploaded"
 *   - doc:deleted      → "🗑️ Document deleted"
 *   - connection:created → "🔗 New connection: <name>"
 *   - connection:removed → "👋 Connection removed"
 *   - client:registered → "✨ New client signed up"
 *
 * Non-render component: returns null.
 */
import { useCallback } from "react";
import { useDocsSocket, type DocsEvent } from "./useDocsSocket";
import { useToast } from "./Toast";
import { useAuth } from "./auth";

export function ToastSocketBridge() {
  const toast = useToast();
  const { user } = useAuth();

  const onEvent = useCallback((e: DocsEvent) => {
    if (!user) return;
    switch (e.type) {
      case "doc:created": {
        const fname = e.doc?.filename || "document";
        toast.show(`New document uploaded — ${fname}`, { kind: "info", icon: "document-text" });
        break;
      }
      case "doc:updated": {
        const fname = e.doc?.filename || "document";
        toast.show(`Document updated — ${fname}`, { kind: "info", icon: "create" });
        break;
      }
      case "doc:deleted": {
        toast.show("Document deleted", { kind: "warn", icon: "trash" });
        break;
      }
      case "connection:created": {
        const name = e.peer?.name || e.peer?.email || "user";
        toast.show(`New connection: ${name}`, { kind: "success", icon: "link" });
        break;
      }
      case "connection:removed": {
        toast.show("Connection removed", { kind: "warn", icon: "unlink" });
        break;
      }
      case "client:registered": {
        if (user.role !== "admin") return;
        const name = e.client?.name || e.client?.email || "client";
        toast.show(`New client signed up: ${name}`, { kind: "success", icon: "person-add" });
        break;
      }
      default:
        break;
    }
  }, [toast, user]);

  useDocsSocket(onEvent);
  return null;
}
