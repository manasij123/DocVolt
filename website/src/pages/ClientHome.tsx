import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { ConnectedAdmin, getToken, getUser, logout, initials, colorFromString } from "../api";
import { useDocsSocket } from "../useDocsSocket";
import LiveBadge from "../LiveBadge";
import ConnectModal from "../ConnectModal";

type Toast = { id: string; title: string; sub?: string; leaving?: boolean };

export default function ClientHome() {
  const nav = useNavigate();
  const me = getUser();
  const [admins, setAdmins] = useState<ConnectedAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken() || me?.role !== "client") { nav("/client/login", { replace: true }); return; }
    reload();
  }, []);

  const reload = async () => {
    setLoading(true);
    try { const r = await api.get<ConnectedAdmin[]>("/admins/connected"); setAdmins(r.data); }
    finally { setLoading(false); }
  };

  const pushToast = (t: Omit<Toast, "id">) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 5);
    setToasts((p) => [...p, { ...t, id }]);
    setTimeout(() => {
      setToasts((p) => p.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 320);
    }, 4000);
  };

  const removeConnection = async (e: React.MouseEvent, a: ConnectedAdmin) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Disconnect from ${a.name}?\n\nYou will no longer see their workspace.\nExisting documents are not deleted.`)) return;
    setAdmins((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await api.delete(`/connections/${a.id}`);
      pushToast({ title: "👋 Disconnected", sub: `${a.name} · removed from your list` });
    } catch (err: any) {
      reload();
      pushToast({ title: "⚠️ Could not disconnect", sub: err?.response?.data?.detail || "Try again later" });
    }
  };

  useDocsSocket((e) => {
    if (e.type === ("connection:created" as any)) {
      const peer = (e as any).peer;
      pushToast({ title: "🔗 Connected with admin", sub: `${peer.name} · ${peer.email}` });
      reload();
      setHighlightId(peer.id);
      setTimeout(() => setHighlightId(null), 4000);
    } else if (e.type === ("connection:removed" as any)) {
      reload();
    } else if (e.type === "doc:created" || e.type === "doc:updated" || e.type === "doc:deleted") {
      reload();
    }
  });

  const onLogout = () => { logout(); nav("/", { replace: true }); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand"><div className="brand-mark">DV</div> DocVault</div>
          <div className="topbar-actions">
            <LiveBadge />
            <span className="who-pill light">{me?.name}</span>
            <button className="icon-btn" title="Logout" onClick={onLogout}>↪</button>
          </div>
        </div>
      </header>

      <main className="container page-anim" style={{ padding: "24px 24px 60px" }}>
        <div className="head-row">
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5 }}>Hello, {me?.name?.split(" ")[0] || "there"}!</h1>
            <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
              {admins.length === 0
                ? "You're not connected with any admin yet. Tap '+ Connect with Admin' below."
                : `Connected with ${admins.length} admin${admins.length === 1 ? "" : "s"}. Tap any to open their documents.`}
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowConnect(true)}>
            ＋ Connect with Admin
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: 22 }}><div className="skeleton" /><div className="skeleton" /></div>
        ) : admins.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔗</div>
            <h3>Connect with your first admin</h3>
            <p style={{ marginBottom: 14 }}>Ask your admin for their email, then tap below to connect — you can be linked to multiple admins.</p>
            <button className="btn btn-primary" onClick={() => setShowConnect(true)}>＋ Connect with Admin</button>
          </div>
        ) : (
          <div className="client-grid" style={{ marginTop: 18 }}>
            {admins.map((a) => (
              <Link key={a.id} to={`/client/a/${a.id}`} className={`client-row admin-row ${highlightId === a.id ? "highlight" : ""}`}>
                <div className="avatar admin" style={{ background: colorFromString(a.id) }}>{initials(a.name)}</div>
                <div className="client-meta">
                  <div className="client-name">{a.name}</div>
                  <div className="client-email">Admin · {a.email}</div>
                </div>
                <div className="client-stats">
                  <div className="stat-num">{a.doc_count}</div>
                  <div className="stat-lbl">{a.doc_count === 1 ? "file" : "files"}</div>
                </div>
                <button
                  type="button"
                  className="row-remove-btn"
                  onClick={(e) => removeConnection(e, a)}
                  aria-label={`Disconnect from ${a.name}`}
                  title="Disconnect"
                >
                  ×
                </button>
                <span className="client-arrow">→</span>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showConnect && (
        <ConnectModal
          peerRole="admin"
          onClose={() => setShowConnect(false)}
          onConnected={() => { setShowConnect(false); reload(); }}
        />
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast created ${t.leaving ? "leaving" : ""}`}>
            <span className="dot" />
            <div className="body"><strong>{t.title}</strong>{t.sub && <small>{t.sub}</small>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
