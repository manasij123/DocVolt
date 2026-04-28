import { useEffect, useState } from "react";
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
type SADashboard = {
  stats: { users: number; admins: number; clients: number; connections: number; documents: number };
  users: SAUser[]; admins: SAAdmin[]; clients: SAClient[]; connections: SAConnection[];
};

type Tab = "overview" | "users" | "admins" | "clients" | "connections";

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

  if (loading) {
    return <div style={{ padding: 40, color: "#fff", background: "#0F172A", minHeight: "100vh" }}>Loading…</div>;
  }
  if (err || !data) {
    return <div style={{ padding: 40, color: "#fff", background: "#0F172A", minHeight: "100vh" }}>⚠ {err || "No data"}</div>;
  }

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
        <button className="btn btn-ghost" onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, color: "#fff", borderColor: "#475569" }}>
          <Ic kind="logout" size={18} /> Logout
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
        <TabBtn active={tab === "connections"} onClick={() => setTab("connections")}>🔗 Connections ({stats.connections})</TabBtn>
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
          <Table
            head={["Admin", "→", "Client", "Initiated by", "Docs", "Linked at"]}
            rows={data.connections
              .filter((cn) => filterText(cn.admin_name, cn.admin_email, cn.client_name, cn.client_email))
              .map((cn) => [
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
    </div>
  );
}

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
  const { stats, admins, clients, connections } = data;
  // Top admins
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
