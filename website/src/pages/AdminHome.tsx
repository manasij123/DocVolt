import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { ClientRow, getToken, getUser, logout, initials, colorFromString } from "../api";
import { useDocsSocket } from "../useDocsSocket";
import LiveBadge from "../LiveBadge";

type Toast = { id: string; title: string; sub?: string; leaving?: boolean };

export default function AdminHome() {
  const nav = useNavigate();
  const me = getUser();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken() || me?.role !== "admin") { nav("/admin/login", { replace: true }); return; }
    reload();
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await api.get<ClientRow[]>("/clients");
      setClients(r.data);
    } finally { setLoading(false); }
  };

  const pushToast = (t: Omit<Toast, "id">) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 5);
    setToasts((p) => [...p, { ...t, id }]);
    setTimeout(() => {
      setToasts((p) => p.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 320);
    }, 4200);
  };

  // Real-time: new client registration toast + auto-add to list with brief highlight
  useDocsSocket((e) => {
    if (e.type === "client:registered") {
      const c = e.client;
      pushToast({ title: "🎉 New client registered", sub: `${c.name} · ${c.email}` });
      setClients((prev) => prev.some((x) => x.id === c.id) ? prev : [{ ...c, doc_count: 0, last_upload_at: null } as ClientRow, ...prev]);
      setHighlightId(c.id);
      setTimeout(() => setHighlightId(null), 4000);
    } else if (e.type === "doc:created" || e.type === "doc:deleted" || e.type === "doc:updated") {
      // refresh counts in the background
      reload();
    }
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [clients, search]);

  const myClients = filtered.filter((c) => c.doc_count > 0);
  const newClients = filtered.filter((c) => c.doc_count === 0);
  const totalDocs = clients.reduce((s, c) => s + (c.doc_count || 0), 0);

  const onLogout = () => { logout(); nav("/", { replace: true }); };

  const renderRow = (c: ClientRow, isNew = false) => (
    <Link key={c.id} to={`/admin/c/${c.id}`} className={`client-row ${highlightId === c.id ? "highlight" : ""}`}>
      <div className="avatar" style={{ background: colorFromString(c.id) }}>{initials(c.name)}</div>
      <div className="client-meta">
        <div className="client-name">
          {c.name}
          {isNew && <span className="new-tag">NEW</span>}
        </div>
        <div className="client-email">{c.email}</div>
      </div>
      <div className="client-stats">
        <div className="stat-num">{c.doc_count}</div>
        <div className="stat-lbl">{c.doc_count === 1 ? "file" : "files"}</div>
      </div>
      <span className="client-arrow">→</span>
    </Link>
  );

  return (
    <div className="app-shell">
      <header className="topbar admin-bar">
        <div className="container topbar-inner">
          <div className="brand"><div className="brand-mark">DV</div> Admin Console</div>
          <div className="topbar-actions">
            <LiveBadge />
            <span className="who-pill">{me?.name}</span>
            <button className="btn btn-sm" style={{ background: "rgba(255,255,255,0.10)", color: "#fff", borderRadius: 9, padding: "8px 14px" }} onClick={onLogout}>Logout ↪</button>
          </div>
        </div>
      </header>

      <main className="container page-anim" style={{ padding: "24px 24px 60px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5 }}>Your clients</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>
          {clients.length} registered · <strong>{myClients.length}</strong> under you · {totalDocs} total files
        </p>

        <div className="search-row">
          <span>🔍</span>
          <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" />
        </div>

        {loading ? (
          <div><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
        ) : clients.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👥</div>
            <h3>No clients yet</h3>
            <p>When a client registers, they'll appear here automatically.</p>
          </div>
        ) : (
          <>
            {myClients.length > 0 && (
              <section>
                <div className="section-head"><span className="section-dot MONTHLY_RETURN" /><span className="section-title">Under You</span><span className="section-count">· {myClients.length}</span></div>
                <div className="client-grid">{myClients.map((c) => renderRow(c))}</div>
              </section>
            )}
            {newClients.length > 0 && (
              <section>
                <div className="section-head"><span className="section-dot FORWARDING_LETTER" /><span className="section-title">Registered Clients</span><span className="section-count">· {newClients.length} · not yet served</span></div>
                <div className="client-grid">{newClients.map((c) => renderRow(c, true))}</div>
              </section>
            )}
          </>
        )}
      </main>

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
