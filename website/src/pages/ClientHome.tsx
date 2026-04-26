import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { ConnectedAdmin, getToken, getUser, logout, initials, colorFromString } from "../api";
import { useDocsSocket } from "../useDocsSocket";
import LiveBadge from "../LiveBadge";

export default function ClientHome() {
  const nav = useNavigate();
  const me = getUser();
  const [admins, setAdmins] = useState<ConnectedAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken() || me?.role !== "client") { nav("/client/login", { replace: true }); return; }
    reload();
  }, []);

  const reload = async () => {
    setLoading(true);
    try { const r = await api.get<ConnectedAdmin[]>("/admins/connected"); setAdmins(r.data); }
    finally { setLoading(false); }
  };

  useDocsSocket((e) => {
    if (e.type === "doc:created" || e.type === "doc:updated" || e.type === "doc:deleted") reload();
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
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5 }}>Hello, {me?.name?.split(" ")[0] || "there"}!</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
          {admins.length === 0
            ? "You haven't received any documents yet. Once an admin uploads for you, they'll appear below."
            : `You have ${admins.length} admin${admins.length === 1 ? "" : "s"} sharing documents with you.`}
        </p>

        {loading ? (
          <div><div className="skeleton" /><div className="skeleton" /></div>
        ) : admins.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">⏳</div>
            <h3>Waiting for documents</h3>
            <p>An admin will see your registration and start uploading.</p>
          </div>
        ) : (
          <div className="client-grid">
            {admins.map((a) => (
              <Link key={a.id} to={`/client/a/${a.id}`} className="client-row admin-row">
                <div className="avatar admin" style={{ background: colorFromString(a.id) }}>{initials(a.name)}</div>
                <div className="client-meta">
                  <div className="client-name">{a.name}</div>
                  <div className="client-email">Admin · {a.email}</div>
                </div>
                <div className="client-stats">
                  <div className="stat-num">{a.doc_count}</div>
                  <div className="stat-lbl">{a.doc_count === 1 ? "file" : "files"}</div>
                </div>
                <span className="client-arrow">→</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
