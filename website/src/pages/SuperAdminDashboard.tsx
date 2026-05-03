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

      {/* Heatmap calendar */}
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <h3>📅 Upload activity — last 12 weeks</h3>
            <span className="sa-sub">Each square = one day · darker = more uploads</span>
          </div>
          <div className="sa-delta">
            <span className="sa-delta-num">{documents.length}</span>
            <span className="sa-delta-label">docs all-time</span>
          </div>
        </div>
        <CalendarHeatmap docs={documents} weeks={12} />
      </div>

      {/* Trend comparison — Users vs Docs */}
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <h3>📈 Growth — last 30 days</h3>
            <span className="sa-sub">New user signups vs. new document uploads</span>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <div className="sa-legend-inline"><span style={{ background: "#7C3AED" }} /> Users</div>
            <div className="sa-legend-inline"><span style={{ background: "#10B981" }} /> Docs</div>
          </div>
        </div>
        <TrendCompare users={data.users} docs={documents} days={30} />
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

      {/* Funnel */}
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <h3>🔻 User engagement funnel</h3>
            <span className="sa-sub">How users progress from signup → active doc management</span>
          </div>
        </div>
        <Funnel
          stages={[
            { label: "Total users", value: stats.users, color: "#3801FF" },
            { label: "Connected users", value: [...admins, ...clients].filter((u: any) => (u.client_count || u.admin_count) > 0).length, color: "#5B2EFF" },
            { label: "Active (≥1 doc)", value: [...admins, ...clients].filter((u: any) => (u.doc_count || 0) > 0).length, color: "#7C3AED" },
            { label: "Power users (≥5 docs)", value: [...admins, ...clients].filter((u: any) => (u.doc_count || 0) >= 5).length, color: "#9333EA" },
          ]}
        />
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
 * Funnel — SVG trapezoid stages with conversion %
 * ────────────────────────────────────────────────────────────── */
function Funnel({ stages }: { stages: { label: string; value: number; color: string }[] }) {
  if (!stages.length) return null;
  const top = Math.max(1, stages[0].value);
  const width = 640;
  const height = 300;
  const stageH = height / stages.length;
  const cx = width / 2;
  const minHalf = 40; // narrowest half-width

  const halfW = (v: number) => {
    const pct = v / top;
    return minHalf + pct * (cx - minHalf);
  };

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <svg width="100%" height={height + 20} viewBox={`0 0 ${width} ${height + 20}`} style={{ flex: 1, maxWidth: 640 }}>
        {stages.map((s, i) => {
          const topV = i === 0 ? s.value : stages[i - 1].value;
          const botV = s.value;
          const y = i * stageH + 10;
          const hw1 = halfW(topV);
          const hw2 = halfW(botV);
          const points = [
            `${cx - hw1},${y}`,
            `${cx + hw1},${y}`,
            `${cx + hw2},${y + stageH}`,
            `${cx - hw2},${y + stageH}`,
          ].join(" ");
          return (
            <g key={i}>
              <polygon points={points} fill={s.color} opacity={0.85 - i * 0.12}>
                <title>{s.label}: {s.value}</title>
              </polygon>
              <text x={cx} y={y + stageH / 2 + 5} textAnchor="middle" fill="#fff" fontSize={14} fontWeight={800}>
                {s.value}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
        {stages.map((s, i) => {
          const conv = i === 0 ? 100 : Math.round((s.value / Math.max(1, stages[i - 1].value)) * 100);
          return (
            <div key={i} style={{ padding: "8px 12px", borderLeft: `4px solid ${s.color}`, background: "#F8FAFC", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{s.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</span>
                {i > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: conv >= 50 ? "#10B981" : "#EF4444" }}>
                    {conv}% ↓
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * TrendCompare — Dual-line chart (Users vs Docs per day)
 * ────────────────────────────────────────────────────────────── */
function TrendCompare({ users, docs, days = 30 }: { users: SAUser[]; docs: SADocument[]; days?: number }) {
  const { userSeries, docSeries, xLabels } = useMemo(() => {
    const u: number[] = Array(days).fill(0);
    const d: number[] = Array(days).fill(0);
    const now = Date.now();
    const startMs = now - (days - 1) * 24 * 60 * 60 * 1000;
    const bucket = (iso?: string): number | null => {
      if (!iso) return null;
      const t = new Date(iso).getTime();
      if (t < startMs - 12 * 3600 * 1000) return null;
      const i = Math.floor((t - startMs) / (24 * 60 * 60 * 1000));
      return i >= 0 && i < days ? i : null;
    };
    users.forEach((usr) => { const i = bucket(usr.created_at); if (i !== null) u[i]++; });
    docs.forEach((doc)  => { const i = bucket(doc.uploaded_at); if (i !== null) d[i]++; });
    const labels: string[] = [];
    for (let i = 0; i < days; i++) {
      const dt = new Date(startMs + i * 86400000);
      labels.push(`${dt.getDate()}/${dt.getMonth() + 1}`);
    }
    return { userSeries: u, docSeries: d, xLabels: labels };
  }, [users, docs, days]);

  const w = 640, h = 180, pad = 12, padY = 20;
  const max = Math.max(1, ...userSeries, ...docSeries);
  const step = (w - pad * 2) / (days - 1);
  const toY = (v: number) => h - padY - (v / max) * (h - padY * 2);
  const pointsFor = (arr: number[]) => arr.map((v, i) => `${pad + i * step},${toY(v)}`).join(" ");

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 8 }}>
      <defs>
        <linearGradient id="trend-u-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trend-d-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={w - pad}
              y1={h - padY - g * (h - padY * 2)} y2={h - padY - g * (h - padY * 2)}
              stroke="#E2E8F0" strokeDasharray="3 6" />
      ))}
      <polyline points={`${pad},${h - padY} ${pointsFor(userSeries)} ${w - pad},${h - padY}`} fill="url(#trend-u-grad)" />
      <polyline points={`${pad},${h - padY} ${pointsFor(docSeries)} ${w - pad},${h - padY}`}  fill="url(#trend-d-grad)" />
      <polyline points={pointsFor(userSeries)} fill="none" stroke="#7C3AED" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pointsFor(docSeries)}  fill="none" stroke="#10B981" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {/* dots on non-zero days */}
      {userSeries.map((v, i) => v > 0 ? <circle key={`u${i}`} cx={pad + i * step} cy={toY(v)} r={3} fill="#fff" stroke="#7C3AED" strokeWidth={2} /> : null)}
      {docSeries.map((v, i) => v > 0 ? <circle key={`d${i}`} cx={pad + i * step} cy={toY(v)} r={3} fill="#fff" stroke="#10B981" strokeWidth={2} /> : null)}
      {/* axis labels: first, mid, last */}
      {[0, Math.floor(days / 2), days - 1].map((i) => (
        <text key={i} x={pad + i * step} y={h - 4} textAnchor="middle" fontSize={10} fill="#64748B">{xLabels[i]}</text>
      ))}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
 * CalendarHeatmap — GitHub-style activity grid (12 weeks × 7 days)
 * ────────────────────────────────────────────────────────────── */
function CalendarHeatmap({ docs, weeks = 12 }: { docs: SADocument[]; weeks?: number }) {
  const { matrix, maxVal, total, monthLabels } = useMemo(() => {
    const cols = weeks;
    const now = new Date();
    // Start from the most recent Sunday so columns align weekly
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const dayOfWeek = end.getDay(); // 0 (Sun) .. 6 (Sat)
    const start = new Date(end);
    start.setDate(end.getDate() - (cols * 7 - 1) - dayOfWeek + 1);
    start.setHours(0, 0, 0, 0);

    const buckets: Record<string, number> = {};
    docs.forEach((d) => {
      if (!d.uploaded_at) return;
      const t = new Date(d.uploaded_at);
      if (t < start || t > end) return;
      const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      buckets[k] = (buckets[k] || 0) + 1;
    });

    const matrix: { date: Date; key: string; value: number }[][] = [];
    for (let w = 0; w < cols; w++) {
      const col: { date: Date; key: string; value: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(start);
        cellDate.setDate(start.getDate() + w * 7 + d);
        const k = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}-${String(cellDate.getDate()).padStart(2, "0")}`;
        col.push({ date: cellDate, key: k, value: buckets[k] || 0 });
      }
      matrix.push(col);
    }
    let maxVal = 0;
    let total = 0;
    matrix.forEach((col) => col.forEach((c) => { if (c.value > maxVal) maxVal = c.value; total += c.value; }));

    // Month labels: only show if the first day of the column starts a new month
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthLabels: { col: number; text: string }[] = [];
    let lastMonth = -1;
    matrix.forEach((col, i) => {
      const m = col[0].date.getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col: i, text: monthNames[m] });
        lastMonth = m;
      }
    });
    return { matrix, maxVal, total, monthLabels };
  }, [docs, weeks]);

  const colorFor = (v: number) => {
    if (!v) return "#F1F5F9";
    if (!maxVal) return "#F1F5F9";
    const ratio = v / Math.max(1, maxVal);
    if (ratio <= 0.2) return "#E5DEFF";
    if (ratio <= 0.4) return "#C7B7FF";
    if (ratio <= 0.6) return "#9A7BFF";
    if (ratio <= 0.8) return "#6B40FF";
    return "#3801FF";
  };

  const CELL = 14, GAP = 3;
  const gridH = 7 * (CELL + GAP) - GAP;
  const dayLabels = ["Mon", "Wed", "Fri"];

  return (
    <div className="sa-heatmap">
      {/* Month labels row */}
      <div className="sa-heatmap-months" style={{ marginLeft: 28 }}>
        {monthLabels.map((m, i) => (
          <span key={i} style={{ left: m.col * (CELL + GAP), position: "absolute" }}>{m.text}</span>
        ))}
      </div>
      <div className="sa-heatmap-body">
        {/* Day-of-week labels */}
        <div className="sa-heatmap-days" style={{ height: gridH }}>
          {dayLabels.map((d, i) => (
            <span key={i} style={{ top: ((i * 2) + 1) * (CELL + GAP) + 2 }}>{d}</span>
          ))}
        </div>
        {/* The grid */}
        <svg width={matrix.length * (CELL + GAP)} height={gridH}>
          {matrix.map((col, ci) => col.map((cell, ri) => (
            <rect
              key={`${ci}-${ri}`}
              x={ci * (CELL + GAP)}
              y={ri * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={3}
              fill={colorFor(cell.value)}
            >
              <title>{cell.date.toDateString()} — {cell.value} {cell.value === 1 ? "doc" : "docs"}</title>
            </rect>
          )))}
        </svg>
      </div>
      <div className="sa-heatmap-legend">
        <span>Less</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((r, i) => (
          <span key={i} className="sa-heatmap-sw" style={{ background: colorFor(r * maxVal) }} />
        ))}
        <span>More</span>
        <span className="sa-heatmap-total">{total} uploads in the last {weeks} weeks</span>
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
 * Connections table + Network Graph (spider-web) visualisation
 * ────────────────────────────────────────────────────────────── */
function ConnectionsView({ data, filterText }: {
  data: SADashboard;
  filterText: (...parts: (string | undefined)[]) => boolean;
}) {
  const [view, setView] = useState<"web" | "table">("web");
  const visible = data.connections.filter((c) =>
    filterText(c.admin_name, c.admin_email, c.client_name, c.client_email),
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <SegBtn active={view === "web"}   onClick={() => setView("web")}>🕸️ Network View</SegBtn>
        <SegBtn active={view === "table"} onClick={() => setView("table")}>📋 Table View</SegBtn>
      </div>
      {view === "web" ? (
        <NetworkGraph data={data} visible={visible} />
      ) : (
        <Table
          head={["Admin", "Admin email", "", "Client", "Client email", "Docs", "Connected on"]}
          rows={visible.map((c) => [
            <strong>{c.admin_name}</strong>,
            <span className="muted">{c.admin_email}</span>,
            <span className="sa-arrow">→</span>,
            <strong>{c.client_name}</strong>,
            <span className="muted">{c.client_email}</span>,
            <strong>{c.doc_count}</strong>,
            fmtDate(c.created_at),
          ])}
        />
      )}
    </div>
  );
}

function NetworkGraph({ data, visible }: {
  data: SADashboard; visible: SAConnection[];
}) {
  const adminIds = useMemo(() => Array.from(new Set(visible.map((c) => c.admin_id))), [visible]);
  const clientIds = useMemo(() => Array.from(new Set(visible.map((c) => c.client_id))), [visible]);
  const adminMap = useMemo(() => Object.fromEntries(data.admins.map((a) => [a.id, a])), [data.admins]);
  const clientMap = useMemo(() => Object.fromEntries(data.clients.map((c) => [c.id, c])), [data.clients]);

  const nodeH = 48;
  const gap = 14;
  const padTop = 30;
  const padBottom = 30;
  const colW = 260;
  const midGap = 380;
  const W = colW * 2 + midGap;
  const adminCount = adminIds.length || 1;
  const clientCount = clientIds.length || 1;
  const colHA = padTop + adminCount * nodeH + (adminCount - 1) * gap + padBottom;
  const colHC = padTop + clientCount * nodeH + (clientCount - 1) * gap + padBottom;
  const H = Math.max(colHA, colHC, 360);

  const adminY = (i: number) => padTop + (H - padTop - padBottom - (adminCount * nodeH + (adminCount - 1) * gap)) / 2 + i * (nodeH + gap);
  const clientY = (i: number) => padTop + (H - padTop - padBottom - (clientCount * nodeH + (clientCount - 1) * gap)) / 2 + i * (nodeH + gap);

  const adminX = 0;
  const clientX = colW + midGap;
  const lineStartX = adminX + colW;
  const lineEndX = clientX;

  const adminPos: Record<string, { x: number; y: number }> = {};
  adminIds.forEach((id, i) => { adminPos[id] = { x: lineStartX, y: adminY(i) + nodeH / 2 }; });
  const clientPos: Record<string, { x: number; y: number }> = {};
  clientIds.forEach((id, i) => { clientPos[id] = { x: lineEndX, y: clientY(i) + nodeH / 2 }; });

  const [hoverId, setHoverId] = useState<string | null>(null);
  const isLinkActive = (cn: SAConnection) => !hoverId || cn.admin_id === hoverId || cn.client_id === hoverId;
  const isNodeActive = (id: string) => !hoverId || id === hoverId
    || visible.some((c) => (c.admin_id === id && c.client_id === hoverId) || (c.client_id === id && c.admin_id === hoverId));

  if (visible.length === 0) {
    return <div className="sa-card" style={{ textAlign: "center", padding: 40, color: "#64748B" }}>No connections match your search.</div>;
  }

  return (
    <div className="sa-card sa-netgraph">
      <div className="sa-netgraph-head">
        <div className="sa-netgraph-hlabel admin">🛡️ Admins ({adminIds.length})</div>
        <div className="sa-netgraph-hlabel client">🙋 Clients ({clientIds.length})</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", minWidth: 720 }}>
          <defs>
            <radialGradient id="sa-adminGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sa-clientGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sa-linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>

          {/* connection curves */}
          {visible.map((cn) => {
            const a = adminPos[cn.admin_id];
            const c = clientPos[cn.client_id];
            if (!a || !c) return null;
            const dx = (c.x - a.x) * 0.4;
            const path = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${c.x - dx} ${c.y}, ${c.x} ${c.y}`;
            const active = isLinkActive(cn);
            return (
              <path
                key={cn.id}
                d={path}
                fill="none"
                stroke="url(#sa-linkGrad)"
                strokeWidth={Math.min(1 + Math.log2(1 + cn.doc_count), 3.5)}
                strokeOpacity={active ? 0.85 : 0.2}
                strokeLinecap="round"
              >
                <title>{cn.admin_name} → {cn.client_name} ({cn.doc_count} docs)</title>
              </path>
            );
          })}

          {/* doc count badges mid-link */}
          {visible.map((cn) => {
            if (cn.doc_count === 0) return null;
            const a = adminPos[cn.admin_id]; const c = clientPos[cn.client_id];
            if (!a || !c) return null;
            const mx = (a.x + c.x) / 2;
            const my = (a.y + c.y) / 2;
            const active = isLinkActive(cn);
            return (
              <g key={`b_${cn.id}`} opacity={active ? 1 : 0.3}>
                <circle cx={mx} cy={my} r={12} fill="#FFFFFF" stroke="#3801FF" strokeWidth={1.6} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={10} fontWeight={800} fill="#3801FF">{cn.doc_count}</text>
              </g>
            );
          })}

          {/* Admin nodes */}
          {adminIds.map((id, i) => {
            const a = adminMap[id]; if (!a) return null;
            const y = adminY(i);
            const active = isNodeActive(id);
            return (
              <g key={`a_${id}`}
                 onMouseEnter={() => setHoverId(id)}
                 onMouseLeave={() => setHoverId((h) => h === id ? null : h)}
                 style={{ cursor: "pointer", opacity: active ? 1 : 0.35 }}>
                <ellipse cx={adminX + colW / 2} cy={y + nodeH / 2} rx={colW / 2 + 8} ry={nodeH / 2 + 6} fill="url(#sa-adminGrad)" />
                <rect x={adminX} y={y} width={colW} height={nodeH} rx={10} fill="#FFFFFF" stroke="#7C3AED" strokeWidth={1.5} />
                <circle cx={adminX + 22} cy={y + nodeH / 2} r={14} fill="#7C3AED22" stroke="#7C3AED" />
                <text x={adminX + 22} y={y + nodeH / 2 + 5} textAnchor="middle" fill="#7C3AED" fontWeight={800} fontSize={14}>{a.name?.[0]?.toUpperCase() || "?"}</text>
                <text x={adminX + 46} y={y + 19} fill="#0F172A" fontWeight={800} fontSize={13}>{trunc(a.name, 22)}</text>
                <text x={adminX + 46} y={y + 35} fill="#64748B" fontSize={10}>{trunc(a.email || "", 30)}</text>
                <text x={adminX + colW - 14} y={y + 19} textAnchor="end" fill="#3801FF" fontWeight={800} fontSize={12}>{a.client_count}</text>
                <text x={adminX + colW - 14} y={y + 35} textAnchor="end" fill="#10B981" fontWeight={700} fontSize={10}>{a.doc_count} docs</text>
              </g>
            );
          })}

          {/* Client nodes */}
          {clientIds.map((id, i) => {
            const c = clientMap[id]; if (!c) return null;
            const y = clientY(i);
            const active = isNodeActive(id);
            return (
              <g key={`c_${id}`}
                 onMouseEnter={() => setHoverId(id)}
                 onMouseLeave={() => setHoverId((h) => h === id ? null : h)}
                 style={{ cursor: "pointer", opacity: active ? 1 : 0.35 }}>
                <ellipse cx={clientX + colW / 2} cy={y + nodeH / 2} rx={colW / 2 + 8} ry={nodeH / 2 + 6} fill="url(#sa-clientGrad)" />
                <rect x={clientX} y={y} width={colW} height={nodeH} rx={10} fill="#FFFFFF" stroke="#10B981" strokeWidth={1.5} />
                <circle cx={clientX + 22} cy={y + nodeH / 2} r={14} fill="#10B98122" stroke="#10B981" />
                <text x={clientX + 22} y={y + nodeH / 2 + 5} textAnchor="middle" fill="#10B981" fontWeight={800} fontSize={14}>{c.name?.[0]?.toUpperCase() || "?"}</text>
                <text x={clientX + 46} y={y + 19} fill="#0F172A" fontWeight={800} fontSize={13}>{trunc(c.name, 22)}</text>
                <text x={clientX + 46} y={y + 35} fill="#64748B" fontSize={10}>{trunc(c.email || "", 30)}</text>
                <text x={clientX + colW - 14} y={y + 19} textAnchor="end" fill="#3801FF" fontWeight={800} fontSize={12}>{c.admin_count}</text>
                <text x={clientX + colW - 14} y={y + 35} textAnchor="end" fill="#10B981" fontWeight={700} fontSize={10}>{c.doc_count} docs</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="sa-netgraph-hint">
        Hover any node to highlight its connections · Purple badge = doc count
      </div>
    </div>
  );
}

function SegBtn({ active, children, onClick }: { active: boolean; children: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`sa-seg ${active ? "active" : ""}`}>{children}</button>
  );
}

function trunc(s: string, n: number) { return s && s.length > n ? s.slice(0, n - 1) + "…" : s; }

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
