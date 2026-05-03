import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { clearAuth, getUser } from "../api";
import DashboardShell, { NavItem } from "../layout/DashboardShell";

/* ──────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────── */
type SAUser = {
  id: string; email?: string; username?: string; name: string; role: string; created_at?: string;
};
type SAAdmin = SAUser & { doc_count: number; client_count: number; clients: { id: string; name: string; email: string }[] };
type SAClient = SAUser & { doc_count: number; admin_count: number; admins: { id: string; name: string; email: string }[] };
type SAConnection = {
  id: string; admin_id: string; client_id: string;
  admin_name: string; admin_email: string;
  client_name: string; client_email: string;
  initiated_by?: string; created_at?: string; doc_count: number;
};
type SADocument = {
  id: string; filename: string; category?: string; category_id?: string;
  size_bytes: number; uploaded_at?: string;
  admin_id: string; client_id: string;
  admin_name: string; admin_email: string;
  client_name: string; client_email: string;
};
type SADashboard = {
  stats: { users: number; admins: number; clients: number; connections: number; documents: number };
  users: SAUser[]; admins: SAAdmin[]; clients: SAClient[]; connections: SAConnection[]; documents: SADocument[];
};
type Tab = "overview" | "users" | "admins" | "clients" | "connections" | "documents";

/* ──────────────────────────────────────────────────────────────
 * Main component
 * ────────────────────────────────────────────────────────────── */
export default function SuperAdminDashboard() {
  const nav = useNavigate();
  const me = getUser();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<SADashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!me || me.role !== "superadmin") { nav("/superadmin/login", { replace: true }); return; }
    (async () => {
      try {
        const r = await api.get<SADashboard>("/superadmin/dashboard");
        setData(r.data);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Failed to load");
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          clearAuth(); nav("/superadmin/login", { replace: true });
        }
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, []);

  const filterText = (...parts: (string | undefined)[]) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return parts.some((p) => (p || "").toLowerCase().includes(q));
  };

  // Build sidebar nav items (all tabs + counts live here now)
  const navItems: NavItem[] = [
    { to: "#overview",    label: "Overview",    onPress: () => setTab("overview"),    matches: () => tab === "overview",
      icon: <NavSvg path="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 4a3 3 0 106 0 3 3 0 00-6 0z" /> },
    { to: "#users",       label: "All Users",    onPress: () => setTab("users"),       matches: () => tab === "users",       badge: data?.stats.users,
      icon: <NavSvg path="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /> },
    { to: "#admins",      label: "Admins",       onPress: () => setTab("admins"),      matches: () => tab === "admins",      badge: data?.stats.admins,
      icon: <NavSvg path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },
    { to: "#clients",     label: "Clients",      onPress: () => setTab("clients"),     matches: () => tab === "clients",     badge: data?.stats.clients,
      icon: <NavSvg path="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" /> },
    { to: "#connections", label: "Connections",  onPress: () => setTab("connections"), matches: () => tab === "connections", badge: data?.stats.connections,
      icon: <NavSvg path="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /> },
    { to: "#documents",   label: "Documents",    onPress: () => setTab("documents"),   matches: () => tab === "documents",   badge: data?.stats.documents,
      icon: <NavSvg path="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" /> },
  ];

  if (loading) {
    return (
      <DashboardShell role="superadmin" title="System Owner" nav={navItems} pageTitle="Loading…">
        <div style={{ padding: 40 }}>Loading the universe…</div>
      </DashboardShell>
    );
  }
  if (err || !data) {
    return (
      <DashboardShell role="superadmin" title="System Owner" nav={navItems} pageTitle="Error">
        <div className="empty"><div className="empty-icon">⚠️</div><h3>{err || "No data"}</h3></div>
      </DashboardShell>
    );
  }

  const titleMap: Record<Tab, string> = {
    overview: "Overview",
    users: "All Users",
    admins: "Admins",
    clients: "Clients",
    connections: "Connections",
    documents: "Documents",
  };

  return (
    <DashboardShell
      role="superadmin"
      title="System Owner"
      nav={navItems}
      pageTitle={titleMap[tab]}
      pageSubtitle={tab === "overview"
        ? "Live database snapshot across every admin, client, and document in the network."
        : "Filter with the search bar on the right. Rows update in real time."}
      toolbar={
        <input
          className="sa-search"
          placeholder="🔎 Search name / email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      }
    >
      <div key={tab}>
        {tab === "overview" && <Overview data={data} />}
        {tab === "users" && (
          <Table
            head={["Name", "Email / Username", "Role", "Joined"]}
            rows={data.users.filter((u) => filterText(u.name, u.email, u.username)).map((u) => [
              u.name,
              u.username ? <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{u.username}</span> : (u.email || "—"),
              <RoleBadge role={u.role} />,
              fmtDate(u.created_at),
            ])}
          />
        )}
        {tab === "admins" && (
          <Table
            head={["Admin", "Email", "Docs Uploaded", "Connected Clients", "Joined"]}
            rows={data.admins.filter((a) => filterText(a.name, a.email)).map((a) => [
              a.name, a.email || "—",
              <strong>{a.doc_count}</strong>,
              <ClientChips items={a.clients} />,
              fmtDate(a.created_at),
            ])}
          />
        )}
        {tab === "clients" && (
          <Table
            head={["Client", "Email", "Docs Received", "Connected Admins", "Joined"]}
            rows={data.clients.filter((c) => filterText(c.name, c.email)).map((c) => [
              c.name, c.email || "—",
              <strong>{c.doc_count}</strong>,
              <ClientChips items={c.admins} kind="admin" />,
              fmtDate(c.created_at),
            ])}
          />
        )}
        {tab === "connections" && <ConnectionsView data={data} filterText={filterText} />}
        {tab === "documents"   && <DocumentsTable docs={data.documents} filterText={filterText} />}
      </div>
    </DashboardShell>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Overview — Power-BI-style infographic (SVG, no deps)
 * ────────────────────────────────────────────────────────────── */
function Overview({ data }: { data: SADashboard }) {
  const { stats, admins, clients, connections, documents } = data;
  const topA = [...admins].sort((a, b) => (b.client_count + b.doc_count) - (a.client_count + a.doc_count)).slice(0, 5);
  const topC = [...clients].sort((a, b) => b.doc_count - a.doc_count).slice(0, 5);

  // Documents-per-day sparkline (last 14 days)
  const sparkData = useMemo(() => {
    const days = 14;
    const buckets: number[] = Array(days).fill(0);
    const now = Date.now();
    documents.forEach((d) => {
      if (!d.uploaded_at) return;
      const t = new Date(d.uploaded_at).getTime();
      const daysAgo = Math.floor((now - t) / (1000 * 60 * 60 * 24));
      if (daysAgo >= 0 && daysAgo < days) buckets[days - 1 - daysAgo]++;
    });
    return buckets;
  }, [documents]);

  return (
    <div className="sa-overview">
      {/* KPI hero tiles */}
      <div className="sa-kpi-grid">
        <KpiTile color="#3801FF" label="Total Users"     value={stats.users}       icon="👥" trend={sparkData} />
        <KpiTile color="#7C3AED" label="Admins"          value={stats.admins}      icon="🛡️" />
        <KpiTile color="#0EA5E9" label="Clients"         value={stats.clients}     icon="🙋" />
        <KpiTile color="#10B981" label="Connections"     value={stats.connections} icon="🔗" />
        <KpiTile color="#F59E0B" label="Documents"       value={stats.documents}   icon="📄" trend={sparkData} />
      </div>

      {/* Donut + Sparkline row */}
      <div className="sa-row2">
        <div className="sa-card">
          <div className="sa-card-head">
            <div>
              <h3>User distribution</h3>
              <span className="sa-sub">Admins vs. clients across the network</span>
            </div>
          </div>
          <div className="sa-donut-wrap">
            <DonutChart
              segments={[
                { label: "Admins", value: stats.admins, color: "#7C3AED" },
                { label: "Clients", value: stats.clients, color: "#10B981" },
              ]}
              center={<>
                <div className="sa-donut-value">{stats.users}</div>
                <div className="sa-donut-label">total users</div>
              </>}
            />
            <div className="sa-legend">
              <LegendItem color="#7C3AED" label="Admins" value={stats.admins} total={stats.users} />
              <LegendItem color="#10B981" label="Clients" value={stats.clients} total={stats.users} />
            </div>
          </div>
        </div>

        <div className="sa-card">
          <div className="sa-card-head">
            <div>
              <h3>Uploads — last 14 days</h3>
              <span className="sa-sub">Every document uploaded, by day</span>
            </div>
            <div className="sa-delta">
              <span className="sa-delta-num">{sparkData.reduce((a, b) => a + b, 0)}</span>
              <span className="sa-delta-label">docs this period</span>
            </div>
          </div>
          <AreaChart values={sparkData} />
        </div>
      </div>

      {/* Bar charts row */}
      <div className="sa-row2">
        <div className="sa-card">
          <div className="sa-card-head">
            <div>
              <h3>🏆 Top admins by activity</h3>
              <span className="sa-sub">client count + doc count combined</span>
            </div>
          </div>
          <BarRank
            items={topA.map((a) => ({
              id: a.id,
              name: a.name,
              sublabel: a.email || "",
              value: a.client_count + a.doc_count,
              breakdown: [
                { label: "clients", value: a.client_count, color: "#7C3AED" },
                { label: "docs", value: a.doc_count, color: "#10B981" },
              ],
            }))}
          />
        </div>

        <div className="sa-card">
          <div className="sa-card-head">
            <div>
              <h3>📥 Top clients by docs received</h3>
              <span className="sa-sub">who is most active on the receiving end</span>
            </div>
          </div>
          <BarRank
            items={topC.map((c) => ({
              id: c.id,
              name: c.name,
              sublabel: c.email || "",
              value: c.doc_count,
              breakdown: [
                { label: "docs", value: c.doc_count, color: "#10B981" },
                { label: "admins", value: c.admin_count, color: "#7C3AED" },
              ],
            }))}
          />
        </div>
      </div>

      {/* Recent activity */}
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <h3>🕒 Recent connections</h3>
            <span className="sa-sub">Latest admin ↔ client handshakes</span>
          </div>
        </div>
        <div className="sa-activity">
          {connections.length === 0 ? (
            <div className="muted" style={{ padding: 16 }}>No connections yet.</div>
          ) : connections.slice(0, 6).map((cn) => (
            <div key={cn.id} className="sa-activity-row">
              <div className="sa-dot admin"><span>A</span></div>
              <div className="sa-row-meta">
                <div className="sa-row-title">
                  <strong>{cn.admin_name}</strong>
                  <span className="sa-arrow">→</span>
                  <strong>{cn.client_name}</strong>
                </div>
                <div className="sa-row-sub">{cn.doc_count} docs shared · {fmtDate(cn.created_at)}</div>
              </div>
              <div className="sa-row-pill">{cn.doc_count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * KPI Tile — gradient card with value + tiny sparkline
 * ────────────────────────────────────────────────────────────── */
function KpiTile({ label, value, color, icon, trend }: {
  label: string; value: number; color: string; icon?: string; trend?: number[];
}) {
  const displayed = useCountUp(value);
  return (
    <div className="sa-kpi" style={{
      background: `linear-gradient(135deg, ${color}0D 0%, ${color}1A 100%)`,
      borderColor: `${color}33`,
    }}>
      <div className="sa-kpi-top">
        <span className="sa-kpi-label">{label}</span>
        {icon && <span className="sa-kpi-icon" style={{ background: `${color}22`, color }}>{icon}</span>}
      </div>
      <div className="sa-kpi-value" style={{ color }}>{displayed}</div>
      {trend && trend.length > 1 && <SparkLine values={trend} color={color} />}
    </div>
  );
}

function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf: any;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/* ──────────────────────────────────────────────────────────────
 * SparkLine — tiny inline area chart
 * ────────────────────────────────────────────────────────────── */
function SparkLine({ values, color }: { values: number[]; color: string }) {
  const w = 100;
  const h = 28;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 6 }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.42" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={area} fill={`url(#sg-${color.replace("#", "")})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Donut chart — SVG, two or more segments
 * ────────────────────────────────────────────────────────────── */
function DonutChart({ segments, center }: {
  segments: { label: string; value: number; color: string }[];
  center?: React.ReactNode;
}) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const size = 220;
  const stroke = 34;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#EEF2F7" strokeWidth={stroke} fill="none"
        />
        {segments.map((s, i) => {
          const pct = s.value / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const offset = circumference - acc * circumference;
          acc += pct;
          return (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={radius}
              stroke={s.color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-((acc - pct) * circumference)}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          );
        })}
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center",
      }}>{center}</div>
    </div>
  );
}
function LegendItem({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="sa-legend-item">
      <span className="sa-legend-dot" style={{ background: color }} />
      <span className="sa-legend-label">{label}</span>
      <span className="sa-legend-value">{value}</span>
      <span className="sa-legend-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * AreaChart — small 14-day area chart
 * ────────────────────────────────────────────────────────────── */
function AreaChart({ values }: { values: number[] }) {
  const w = 520, h = 140, pad = 10;
  const max = Math.max(1, ...values);
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const area = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 8 }}>
      <defs>
        <linearGradient id="sa-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3801FF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#3801FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={h - pad - g * (h - pad * 2)} y2={h - pad - g * (h - pad * 2)}
              stroke="#E2E8F0" strokeDasharray="3 6" />
      ))}
      <polyline points={area} fill="url(#sa-area)" stroke="none" />
      <polyline points={pts} fill="none" stroke="#3801FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = pad + i * step;
        const y = h - pad - (v / max) * (h - pad * 2);
        return v > 0 ? <circle key={i} cx={x} cy={y} r={3} fill="#FFF" stroke="#3801FF" strokeWidth={2} /> : null;
      })}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Horizontal Bar Rank — stacked breakdown
 * ────────────────────────────────────────────────────────────── */
function BarRank({ items }: {
  items: { id: string; name: string; sublabel: string; value: number; breakdown: { label: string; value: number; color: string }[] }[];
}) {
  if (items.length === 0) return <div className="muted" style={{ padding: 16 }}>Nothing to show yet.</div>;
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <div className="sa-bar-list">
      {items.map((it) => {
        const pct = (it.value / max) * 100;
        return (
          <div key={it.id} className="sa-bar-row">
            <div className="sa-bar-meta">
              <div className="sa-bar-name">{it.name}</div>
              <div className="sa-bar-sub">{it.sublabel}</div>
            </div>
            <div className="sa-bar-track">
              <div className="sa-bar-fill" style={{ width: `${pct}%` }}>
                {it.breakdown.map((b, i) => {
                  const segPct = it.value ? (b.value / it.value) * 100 : 0;
                  return (
                    <div key={i} title={`${b.label}: ${b.value}`}
                      style={{ width: `${segPct}%`, background: b.color }} />
                  );
                })}
              </div>
            </div>
            <div className="sa-bar-value">{it.value}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Connections table + graph (reused / simplified from old UI)
 * ────────────────────────────────────────────────────────────── */
function ConnectionsView({ data, filterText }: {
  data: SADashboard;
  filterText: (...parts: (string | undefined)[]) => boolean;
}) {
  const rows = data.connections
    .filter((c) => filterText(c.admin_name, c.admin_email, c.client_name, c.client_email))
    .map((c) => [
      <strong>{c.admin_name}</strong>,
      <span className="muted">{c.admin_email}</span>,
      <span className="sa-arrow">→</span>,
      <strong>{c.client_name}</strong>,
      <span className="muted">{c.client_email}</span>,
      <strong>{c.doc_count}</strong>,
      fmtDate(c.created_at),
    ]);
  return (
    <Table
      head={["Admin", "Admin email", "", "Client", "Client email", "Docs", "Connected on"]}
      rows={rows}
    />
  );
}

function DocumentsTable({ docs, filterText }: {
  docs: SADocument[];
  filterText: (...parts: (string | undefined)[]) => boolean;
}) {
  const rows = docs
    .filter((d) => filterText(d.filename, d.admin_name, d.client_name, d.category))
    .map((d) => [
      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>{d.filename}</span>,
      d.category || "—",
      fmtSize(d.size_bytes),
      d.admin_name,
      d.client_name,
      fmtDate(d.uploaded_at),
    ]);
  return (
    <Table
      head={["Filename", "Category", "Size", "Admin", "Client", "Uploaded"]}
      rows={rows}
    />
  );
}

/* ──────────────────────────────────────────────────────────────
 * Small helpers
 * ────────────────────────────────────────────────────────────── */
function NavSvg({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    superadmin: { bg: "#3801FF22", fg: "#3801FF", label: "Super Admin" },
    admin:      { bg: "#7C3AED22", fg: "#7C3AED", label: "Admin" },
    client:     { bg: "#10B98122", fg: "#10B981", label: "Client" },
  };
  const m = map[role] || { bg: "#64748B22", fg: "#64748B", label: role };
  return <span style={{ background: m.bg, color: m.fg, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{m.label}</span>;
}

function ClientChips({ items, kind = "client" }: { items: { id: string; name: string; email: string }[]; kind?: "client" | "admin" }) {
  if (!items.length) return <span className="muted">None</span>;
  const color = kind === "client" ? "#10B981" : "#7C3AED";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((i) => (
        <span key={i.id} title={i.email} style={{ background: `${color}22`, color, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
          {i.name}
        </span>
      ))}
    </div>
  );
}

function Table({ head, rows }: { head: any[]; rows: any[][] }) {
  return (
    <div className="sa-table-wrap">
      <table>
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={head.length} style={{ padding: 40, textAlign: "center", color: "#64748B" }}>No data</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}
function fmtSize(b: number) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
