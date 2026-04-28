import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { clearAuth, getUser } from "../api";
import { Ic } from "../Icons";

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

  const logout = () => { clearAuth(); nav("/superadmin/login", { replace: true }); };

  const filterText = (...parts: (string | undefined)[]) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return parts.some((p) => (p || "").toLowerCase().includes(q));
  };

  if (loading) return <div style={{ padding: 40, color: "#fff", background: "#0F172A", minHeight: "100vh" }}>Loading…</div>;
  if (err || !data) return <div style={{ padding: 40, color: "#fff", background: "#0F172A", minHeight: "100vh" }}>⚠ {err || "No data"}</div>;

  const { stats } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#E2E8F0" }}>
      {/* Top Bar */}
      <div style={{
        background: "linear-gradient(135deg, #1E293B 0%, #312E81 100%)",
        padding: "14px 24px", display: "flex", alignItems: "center", gap: 14,
        borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#FACC15,#F59E0B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>System Owner Console</div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>Read-only · Live database snapshot</div>
        </div>
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 Search name / email…"
          style={{ width: 240, background: "#0F172A", color: "#fff", borderColor: "#475569" }}
        />
        <button
          onClick={logout}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#000", color: "#FACC15",
            fontWeight: 800, fontSize: 13, letterSpacing: 0.4,
            padding: "9px 16px", borderRadius: 10,
            border: "1px solid #FACC15", cursor: "pointer",
            boxShadow: "0 4px 14px rgba(250,204,21,0.18)",
          }}
        >
          <Ic kind="logout" size={18} alt="Logout" /> Logout
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ padding: "20px 24px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Total Users"  value={stats.users}       color="#60A5FA" />
        <StatCard label="Admins"       value={stats.admins}      color="#A78BFA" />
        <StatCard label="Clients"      value={stats.clients}     color="#34D399" />
        <StatCard label="Connections"  value={stats.connections} color="#FBBF24" />
        <StatCard label="Documents"    value={stats.documents}   color="#F472B6" />
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 6, padding: "20px 24px 0", borderBottom: "1px solid #1E293B", flexWrap: "wrap" }}>
        <TabBtn active={tab === "overview"}    onClick={() => setTab("overview")}>📊 Overview</TabBtn>
        <TabBtn active={tab === "users"}       onClick={() => setTab("users")}>👥 All Users ({stats.users})</TabBtn>
        <TabBtn active={tab === "admins"}      onClick={() => setTab("admins")}>🛡️ Admins ({stats.admins})</TabBtn>
        <TabBtn active={tab === "clients"}     onClick={() => setTab("clients")}>👤 Clients ({stats.clients})</TabBtn>
        <TabBtn active={tab === "connections"} onClick={() => setTab("connections")}>🕸️ Connections ({stats.connections})</TabBtn>
        <TabBtn active={tab === "documents"}   onClick={() => setTab("documents")}>📄 Documents ({stats.documents})</TabBtn>
      </div>

      {/* Body */}
      <div style={{ padding: 24 }}>
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
        {tab === "connections" && (
          <ConnectionsView data={data} search={search} filterText={filterText} />
        )}
        {tab === "documents" && (
          <DocumentsTable docs={data.documents} filterText={filterText} />
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * Network Graph for Connections — admin nodes on the left,
 * client nodes on the right, with curved "spider-web" links.
 * ============================================================ */
function ConnectionsView({ data, search, filterText }: {
  data: SADashboard; search: string;
  filterText: (...parts: (string | undefined)[]) => boolean;
}) {
  const [view, setView] = useState<"web" | "table">("web");

  // Filter: a connection is included if either side matches the search.
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
        <NetworkGraph data={data} visible={visible} highlight={search.trim().toLowerCase()} />
      ) : (
        <Table
          head={["Admin", "→", "Client", "Initiated by", "Docs", "Linked at"]}
          rows={visible.map((cn) => [
            <span><strong>{cn.admin_name}</strong> <span style={{ color: "#94A3B8" }}>({cn.admin_email})</span></span>,
            <span style={{ color: "#FBBF24" }}>→</span>,
            <span><strong>{cn.client_name}</strong> <span style={{ color: "#94A3B8" }}>({cn.client_email})</span></span>,
            <span style={{ fontSize: 11, color: "#94A3B8" }}>{cn.initiated_by === cn.admin_id ? "Admin" : cn.initiated_by === cn.client_id ? "Client" : "—"}</span>,
            <strong>{cn.doc_count}</strong>,
            fmtDate(cn.created_at),
          ])}
        />
      )}
    </div>
  );
}

function NetworkGraph({ data, visible, highlight }: {
  data: SADashboard; visible: SAConnection[]; highlight: string;
}) {
  // Pick out admins/clients that participate in any visible connection.
  const adminIds = useMemo(() => Array.from(new Set(visible.map((c) => c.admin_id))), [visible]);
  const clientIds = useMemo(() => Array.from(new Set(visible.map((c) => c.client_id))), [visible]);

  const adminMap = useMemo(() => Object.fromEntries(data.admins.map((a) => [a.id, a])), [data.admins]);
  const clientMap = useMemo(() => Object.fromEntries(data.clients.map((c) => [c.id, c])), [data.clients]);

  // Layout: admins on left column, clients on right column.
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

  // Hover state for highlighting
  const [hoverId, setHoverId] = useState<string | null>(null);

  const isLinkActive = (cn: SAConnection) => !hoverId || cn.admin_id === hoverId || cn.client_id === hoverId;
  const isNodeActive = (id: string) => !hoverId || id === hoverId
    || visible.some((c) => (c.admin_id === id && c.client_id === hoverId) || (c.client_id === id && c.admin_id === hoverId));

  if (visible.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748B", background: "#1E293B", borderRadius: 12, border: "1px solid #334155" }}>No connections match your search.</div>;
  }

  return (
    <div style={{ background: "#0B1220", border: "1px solid #334155", borderRadius: 14, padding: 16, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#A78BFA", textTransform: "uppercase", letterSpacing: 0.6 }}>Admins ({adminIds.length})</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#34D399", textTransform: "uppercase", letterSpacing: 0.6 }}>Clients ({clientIds.length})</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", minWidth: 720 }}>
          {/* faint background grid */}
          <defs>
            <radialGradient id="adminGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="clientGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#34D399" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#34D399" />
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
            const matchHL = highlight && (
              cn.admin_name.toLowerCase().includes(highlight) ||
              cn.client_name.toLowerCase().includes(highlight) ||
              (cn.admin_email || "").toLowerCase().includes(highlight) ||
              (cn.client_email || "").toLowerCase().includes(highlight)
            );
            const stroke = matchHL ? "#FACC15" : "url(#linkGrad)";
            return (
              <path
                key={cn.id}
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth={Math.min(1 + Math.log2(1 + cn.doc_count), 3.5)}
                strokeOpacity={active ? 0.85 : 0.18}
                strokeLinecap="round"
              >
                <title>{cn.admin_name} → {cn.client_name} ({cn.doc_count} docs)</title>
              </path>
            );
          })}

          {/* mid-link doc count badges */}
          {visible.map((cn) => {
            if (cn.doc_count === 0) return null;
            const a = adminPos[cn.admin_id]; const c = clientPos[cn.client_id];
            if (!a || !c) return null;
            const mx = (a.x + c.x) / 2;
            const my = (a.y + c.y) / 2;
            const active = isLinkActive(cn);
            return (
              <g key={`b_${cn.id}`} opacity={active ? 1 : 0.25}>
                <circle cx={mx} cy={my} r={11} fill="#0B1220" stroke="#FBBF24" strokeWidth={1.5} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={10} fontWeight={800} fill="#FBBF24">{cn.doc_count}</text>
              </g>
            );
          })}

          {/* Admin nodes (left column) */}
          {adminIds.map((id, i) => {
            const a = adminMap[id]; if (!a) return null;
            const y = adminY(i);
            const active = isNodeActive(id);
            return (
              <g key={`a_${id}`}
                onMouseEnter={() => setHoverId(id)}
                onMouseLeave={() => setHoverId((h) => h === id ? null : h)}
                style={{ cursor: "pointer", opacity: active ? 1 : 0.32 }}>
                <ellipse cx={adminX + colW / 2} cy={y + nodeH / 2} rx={colW / 2 + 8} ry={nodeH / 2 + 6} fill="url(#adminGrad)" />
                <rect x={adminX} y={y} width={colW} height={nodeH} rx={10} fill="#1E1B4B" stroke="#A78BFA" strokeWidth={1.5} />
                <circle cx={adminX + 22} cy={y + nodeH / 2} r={14} fill="#A78BFA22" stroke="#A78BFA" />
                <text x={adminX + 22} y={y + nodeH / 2 + 5} textAnchor="middle" fill="#A78BFA" fontWeight={800} fontSize={14}>{a.name?.[0]?.toUpperCase() || "?"}</text>
                <text x={adminX + 46} y={y + 19} fill="#fff" fontWeight={800} fontSize={13}>{trunc(a.name, 22)}</text>
                <text x={adminX + 46} y={y + 35} fill="#94A3B8" fontSize={10}>{trunc(a.email || "", 30)}</text>
                <text x={adminX + colW - 14} y={y + 19} textAnchor="end" fill="#FBBF24" fontWeight={800} fontSize={12}>{a.client_count}</text>
                <text x={adminX + colW - 14} y={y + 35} textAnchor="end" fill="#34D399" fontWeight={700} fontSize={10}>{a.doc_count} docs</text>
              </g>
            );
          })}

          {/* Client nodes (right column) */}
          {clientIds.map((id, i) => {
            const c = clientMap[id]; if (!c) return null;
            const y = clientY(i);
            const active = isNodeActive(id);
            return (
              <g key={`c_${id}`}
                onMouseEnter={() => setHoverId(id)}
                onMouseLeave={() => setHoverId((h) => h === id ? null : h)}
                style={{ cursor: "pointer", opacity: active ? 1 : 0.32 }}>
                <ellipse cx={clientX + colW / 2} cy={y + nodeH / 2} rx={colW / 2 + 8} ry={nodeH / 2 + 6} fill="url(#clientGrad)" />
                <rect x={clientX} y={y} width={colW} height={nodeH} rx={10} fill="#064E3B" stroke="#34D399" strokeWidth={1.5} />
                <circle cx={clientX + 22} cy={y + nodeH / 2} r={14} fill="#34D39922" stroke="#34D399" />
                <text x={clientX + 22} y={y + nodeH / 2 + 5} textAnchor="middle" fill="#34D399" fontWeight={800} fontSize={14}>{c.name?.[0]?.toUpperCase() || "?"}</text>
                <text x={clientX + 46} y={y + 19} fill="#fff" fontWeight={800} fontSize={13}>{trunc(c.name, 22)}</text>
                <text x={clientX + 46} y={y + 35} fill="#94A3B8" fontSize={10}>{trunc(c.email || "", 30)}</text>
                <text x={clientX + colW - 14} y={y + 19} textAnchor="end" fill="#FBBF24" fontWeight={800} fontSize={12}>{c.admin_count}</text>
                <text x={clientX + colW - 14} y={y + 35} textAnchor="end" fill="#34D399" fontWeight={700} fontSize={10}>{c.doc_count} docs</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "#64748B", textAlign: "center" }}>
        Hover any node to highlight its connections · Yellow badge = doc count · Yellow lines = match your search
      </div>
    </div>
  );
}

function trunc(s: string, n: number) { return s && s.length > n ? s.slice(0, n - 1) + "…" : s; }

function DocumentsTable({ docs, filterText }: {
  docs: SADocument[];
  filterText: (...parts: (string | undefined)[]) => boolean;
}) {
  const visible = docs.filter((d) => filterText(d.admin_name, d.admin_email, d.client_name, d.client_email, d.filename));
  return (
    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", fontSize: 11, color: "#94A3B8", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between" }}>
        <span>📄 Read-only document log — newest first</span>
        <span><strong style={{ color: "#fff" }}>{visible.length}</strong> shown</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ background: "#0F172A" }}>
              {["Admin (sender)", "→", "Client (receiver)", "Filename", "Category", "Size", "Uploaded"].map((h, i) => (
                <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid #334155" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#64748B" }}>No documents</td></tr>
            ) : visible.map((d) => (
              <tr key={d.id} style={{ borderBottom: "1px solid #334155" }}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 700, color: "#A78BFA" }}>{d.admin_name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{d.admin_email}</div>
                </td>
                <td style={{ ...cellStyle, fontSize: 18, color: "#FBBF24" }}>→</td>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 700, color: "#34D399" }}>{d.client_name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{d.client_email}</div>
                </td>
                <td style={cellStyle}>
                  <span style={{ color: "#fff", wordBreak: "break-all" }}>📎 {d.filename}</span>
                </td>
                <td style={cellStyle}>
                  {d.category ? <span style={{ background: "#334155", padding: "2px 8px", borderRadius: 6, fontSize: 11, color: "#FBBF24", fontWeight: 700 }}>{d.category}</span> : <span style={{ color: "#64748B" }}>—</span>}
                </td>
                <td style={{ ...cellStyle, fontSize: 12, color: "#94A3B8" }}>{fmtSize(d.size_bytes)}</td>
                <td style={{ ...cellStyle, fontSize: 12, color: "#94A3B8" }}>{fmtDate(d.uploaded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: "12px 16px", fontSize: 13, color: "#E2E8F0", verticalAlign: "top" };

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#1E293B", border: `1px solid ${color}33`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function TabBtn({ active, children, onClick }: { active: boolean; children: any; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 16px", borderRadius: "10px 10px 0 0",
      border: "1px solid #1E293B",
      borderBottom: active ? "2px solid #FACC15" : "1px solid #1E293B",
      background: active ? "#1E293B" : "transparent",
      color: active ? "#FACC15" : "#94A3B8",
      fontWeight: 700, fontSize: 13, cursor: "pointer",
    }}>{children}</button>
  );
}

function SegBtn({ active, children, onClick }: { active: boolean; children: any; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 8,
      border: "1px solid " + (active ? "#FACC15" : "#334155"),
      background: active ? "#FACC1522" : "transparent",
      color: active ? "#FACC15" : "#94A3B8",
      fontWeight: 700, fontSize: 12, cursor: "pointer",
    }}>{children}</button>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    superadmin: { bg: "#FBBF2433", fg: "#FBBF24", label: "Super Admin" },
    admin:      { bg: "#A78BFA33", fg: "#A78BFA", label: "Admin" },
    client:     { bg: "#34D39933", fg: "#34D399", label: "Client" },
  };
  const m = map[role] || { bg: "#64748B33", fg: "#94A3B8", label: role };
  return <span style={{ background: m.bg, color: m.fg, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{m.label}</span>;
}

function ClientChips({ items, kind = "client" }: { items: { id: string; name: string; email: string }[]; kind?: "client" | "admin" }) {
  if (!items.length) return <span style={{ color: "#64748B" }}>None</span>;
  const color = kind === "client" ? "#34D399" : "#A78BFA";
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
    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: "#0F172A" }}>
              {head.map((h, i) => (
                <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid #334155" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={head.length} style={{ padding: 40, textAlign: "center", color: "#64748B" }}>No data</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #334155" }}>
                {r.map((c, j) => (
                  <td key={j} style={{ padding: "12px 16px", fontSize: 13, color: "#E2E8F0", verticalAlign: "top" }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Overview({ data }: { data: SADashboard }) {
  const { admins, clients, connections } = data;
  const topA = [...admins].sort((a, b) => (b.client_count + b.doc_count) - (a.client_count + a.doc_count)).slice(0, 5);
  const topC = [...clients].sort((a, b) => b.doc_count - a.doc_count).slice(0, 5);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: 18 }}>
        <h3 style={{ fontSize: 14, color: "#FBBF24", margin: 0 }}>🏆 Top Admins (by activity)</h3>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {topA.length === 0 ? <div style={{ color: "#64748B" }}>None</div> : topA.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#A78BFA22", color: "#A78BFA", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{a.name?.[0]?.toUpperCase() || "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#fff" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</div>
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}><strong style={{ color: "#A78BFA" }}>{a.client_count}</strong> clients</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}><strong style={{ color: "#34D399" }}>{a.doc_count}</strong> docs</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: 18 }}>
        <h3 style={{ fontSize: 14, color: "#34D399", margin: 0 }}>📥 Top Clients (by docs received)</h3>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {topC.length === 0 ? <div style={{ color: "#64748B" }}>None</div> : topC.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#34D39922", color: "#34D399", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{c.name?.[0]?.toUpperCase() || "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#fff" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}><strong style={{ color: "#A78BFA" }}>{c.admin_count}</strong> admins</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}><strong style={{ color: "#34D399" }}>{c.doc_count}</strong> docs</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: 18, gridColumn: "1 / -1" }}>
        <h3 style={{ fontSize: 14, color: "#60A5FA", margin: 0 }}>🕒 Recent Connections (last 5)</h3>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {connections.slice(0, 5).map((cn) => (
            <div key={cn.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <strong style={{ color: "#A78BFA" }}>{cn.admin_name}</strong>
              <span style={{ color: "#FBBF24" }}>→</span>
              <strong style={{ color: "#34D399" }}>{cn.client_name}</strong>
              <span style={{ flex: 1, color: "#64748B", fontSize: 11 }}>{cn.doc_count} docs</span>
              <span style={{ color: "#94A3B8", fontSize: 11 }}>{fmtDate(cn.created_at)}</span>
            </div>
          ))}
          {connections.length === 0 && <div style={{ color: "#64748B" }}>No connections yet.</div>}
        </div>
      </div>
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
