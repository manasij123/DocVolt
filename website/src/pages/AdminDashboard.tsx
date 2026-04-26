import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { CATEGORY_LABELS, CATEGORY_ICONS, DocumentMeta, fileUrl, getToken, setRole, setToken } from "../api";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_MAP: Record<string, number> = {
  jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,
  jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12,
};

function detectCategory(name: string) {
  const n = name.toLowerCase();
  if (n.includes("monthly return") || n.includes("monthly_return")) return "MONTHLY_RETURN";
  if (n.includes("forwarding-letter") || n.includes("forwarding letter") || n.includes("forwarding_letter")) return "FORWARDING_LETTER";
  if (n.includes("ifa report") || n.includes("ifa_report") || n.includes("ifareport")) return "IFA_REPORT";
  return "OTHERS";
}
function detectMonthYear(name: string): { month: number | null; year: number | null } {
  const n = name.replace(/[_-]/g, " ");
  const re = /\b([A-Za-z]{3,9})\s*['\u2019]?\s*(\d{2,4})(?!\d)/g;
  let m;
  while ((m = re.exec(n)) !== null) {
    const ms = m[1].toLowerCase();
    if (MONTH_MAP[ms]) {
      let y = parseInt(m[2], 10); if (y < 100) y += 2000;
      return { month: MONTH_MAP[ms], year: y };
    }
  }
  const ym = n.match(/\b(20\d{2})\b/);
  return ym ? { month: null, year: parseInt(ym[1], 10) } : { month: null, year: null };
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"upload" | "manage">("upload");
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [editing, setEditing] = useState<DocumentMeta | null>(null);

  useEffect(() => {
    if (!getToken()) {
      nav("/admin/login", { replace: true });
      return;
    }
    api.get("/auth/me").catch(() => {
      setToken(null);
      nav("/admin/login", { replace: true });
    });
  }, [nav]);

  const reload = async () => {
    const r = await api.get<DocumentMeta[]>("/documents");
    setDocs(r.data);
  };
  useEffect(() => { reload(); }, []);

  const onLogout = () => {
    setToken(null);
    setRole(null);
    nav("/", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar admin-bar">
        <div className="container topbar-inner">
          <div className="brand"><div className="brand-mark">DV</div> Admin Console</div>
          <div className="topbar-actions">
            <button className="btn btn-sm" style={{ background: "rgba(255,255,255,0.10)", color: "#fff", borderRadius: 9, padding: "8px 14px" }} onClick={onLogout}>Logout ↪</button>
          </div>
        </div>
      </header>

      <div className="container" style={{ paddingTop: 14 }}>
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")}>📤 Upload</button>
          <button className={`admin-tab ${tab === "manage" ? "active" : ""}`} onClick={() => { setTab("manage"); reload(); }}>⚙️ Manage</button>
        </div>
      </div>

      <main className="container" style={{ padding: "20px 24px 60px" }}>
        {tab === "upload" ? <UploadPanel onUploaded={reload} /> : <ManagePanel docs={docs} setDocs={setDocs} filter={filter} setFilter={setFilter} setEditing={setEditing} />}
      </main>

      {editing && <EditModal doc={editing} onClose={() => setEditing(null)} onSaved={(d) => { setDocs((prev) => prev.map((x) => (x.id === d.id ? d : x))); setEditing(null); }} />}
    </div>
  );
}

/* ─── Upload Panel ─────────────────────────────────────────── */
function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const [picked, setPicked] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "scanned" | "manual">("idle");
  const [detCat, setDetCat] = useState("OTHERS");
  const [detYear, setDetYear] = useState<number | null>(null);
  const [detMonth, setDetMonth] = useState<number | null>(null);
  const [cat, setCat] = useState("OTHERS");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    setPicked(f);
    const c = detectCategory(f.name);
    const my = detectMonthYear(f.name);
    setDetCat(c); setDetYear(my.year); setDetMonth(my.month);
    setCat(c); if (my.year) setYear(my.year); setMonth(my.month);
    setStage("scanned"); setDone(null); setErr(null);
  };

  const send = async (cTo: string, yTo: number, mTo: number | null) => {
    if (!picked) return;
    setUploading(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", picked);
      fd.append("category_override", cTo);
      fd.append("year_override", String(yTo));
      if (mTo !== null) fd.append("month_override", String(mTo));
      const r = await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDone(r.data.display_name);
      setPicked(null); setStage("idle");
      onUploaded();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const looksGood = detCat !== "OTHERS" && detYear !== null && detMonth !== null;
  const yrs = [year - 2, year - 1, year, year + 1];

  return (
    <>
      <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>Upload PDF</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
        Pick a PDF — the website will scan its name and tell you which tab/year/month it belongs to.
      </p>

      {done && <div className="banner success">✓ Uploaded: {done}</div>}
      {err && <div className="banner error">{err}</div>}

      <label className="dropzone" htmlFor="file-input">
        <div className="dropzone-icon">📄</div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{picked ? picked.name : "Tap to choose a PDF"}</div>
        <div className="muted" style={{ marginTop: 6 }}>{picked ? `${(picked.size / 1024).toFixed(0)} KB · Tap to change` : "PDF only"}</div>
        <input id="file-input" type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0] || null)} />
      </label>

      {stage === "scanned" && picked && (
        <div className="detect-card">
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: looksGood ? "linear-gradient(135deg,#43A047,#1B5E20)" : "linear-gradient(135deg,#FFA726,#F57C00)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              {looksGood ? "✓" : "!"}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{looksGood ? "Filename matched" : "Format unclear"}</div>
              <div className="muted">{looksGood ? "Auto-detected from filename" : "Some details missing"}</div>
            </div>
          </div>
          <div style={{ background: "#F8F9FA", borderRadius: 12, padding: 4 }}>
            <div className="detect-row"><span className="lbl">Tab</span> <span className={`val ${detCat === "OTHERS" ? "warn" : ""}`}>{CATEGORY_LABELS[detCat]}</span></div>
            <div className="detect-row"><span className="lbl">Year</span> <span className={`val ${!detYear ? "warn" : ""}`}>{detYear ?? "—"}</span></div>
            <div className="detect-row"><span className="lbl">Month</span> <span className={`val ${!detMonth ? "warn" : ""}`}>{detMonth ? MONTHS[detMonth - 1] : "—"}</span></div>
          </div>
          <div className="muted" style={{ textAlign: "center", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 800, fontSize: 11, marginTop: 18, marginBottom: 12 }}>Is this format correct?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStage("manual")} disabled={uploading}>✕ No, manual</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => send(detCat, detYear ?? new Date().getFullYear(), detMonth)} disabled={uploading}>{uploading ? "Uploading…" : "✓ Yes, upload"}</button>
          </div>
        </div>
      )}

      {stage === "manual" && picked && (
        <div className="detect-card">
          <h3 style={{ marginTop: 0 }}>Set category & date manually</h3>
          <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12, marginBottom: 8 }}>Category</div>
          <div className="chip-row">
            {Object.keys(CATEGORY_LABELS).map((k) => (
              <button key={k} className={`chip ${cat === k ? "active" : ""}`} onClick={() => setCat(k)}>{CATEGORY_LABELS[k]}</button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12, marginBottom: 8 }}>Year</div>
          <div className="chip-row">
            {yrs.map((y) => <button key={y} className={`chip ${year === y ? "active" : ""}`} onClick={() => setYear(y)}>{y}</button>)}
          </div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12, marginBottom: 8 }}>Month</div>
          <div className="chip-row">
            <button className={`chip ${month === null ? "active" : ""}`} onClick={() => setMonth(null)}>None</button>
            {MONTHS.map((m, i) => <button key={i} className={`chip ${month === i + 1 ? "active" : ""}`} onClick={() => setMonth(i + 1)}>{m}</button>)}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStage("scanned")} disabled={uploading}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => send(cat, year, month)} disabled={uploading}>{uploading ? "Uploading…" : "📤 Upload"}</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Manage Panel ─────────────────────────────────────────── */
function ManagePanel({ docs, setDocs, filter, setFilter, setEditing }: { docs: DocumentMeta[]; setDocs: (d: DocumentMeta[]) => void; filter: string; setFilter: (f: string) => void; setEditing: (d: DocumentMeta | null) => void; }) {
  const filtered = filter === "ALL" ? docs : docs.filter((d) => d.category === filter);

  const onDelete = async (d: DocumentMeta) => {
    if (!window.confirm(`Delete "${d.display_name}"?`)) return;
    try {
      await api.delete(`/documents/${d.id}`);
      setDocs(docs.filter((x) => x.id !== d.id));
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Delete failed");
    }
  };

  return (
    <>
      <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>Manage Documents</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>{docs.length} total</p>

      <div className="tab-row">
        {["ALL", "MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"].map((k) => (
          <button key={k} className={`tab ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
            {k === "ALL" ? "All" : CATEGORY_LABELS[k]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">📂</div><h3>No documents</h3></div>
      ) : (
        <div className="doc-grid">
          {filtered.map((d) => (
            <div key={d.id} className="doc-card">
              <div className={`doc-icon ${d.category}`}>📄</div>
              <div className="doc-meta">
                <div className="doc-title">{d.display_name}</div>
                <div className="doc-sub">
                  <span>{CATEGORY_LABELS[d.category]}</span>
                  <span>·</span>
                  <span>{d.month_label ? `${d.month_label} ` : ""}{d.year}</span>
                </div>
              </div>
              <div className="doc-actions">
                <button className="act-btn view" title="Open" onClick={() => window.open(fileUrl(d.id), "_blank")}>↗</button>
                <button className="act-btn edit" title="Edit" onClick={() => setEditing(d)}>✎</button>
                <button className="act-btn delete" title="Delete" onClick={() => onDelete(d)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Edit Modal ───────────────────────────────────────────── */
function EditModal({ doc, onClose, onSaved }: { doc: DocumentMeta; onClose: () => void; onSaved: (d: DocumentMeta) => void; }) {
  const [name, setName] = useState(doc.display_name);
  const [cat, setCat] = useState(doc.category);
  const [year, setYear] = useState(doc.year);
  const [month, setMonth] = useState<number | null>(doc.month);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/documents/${doc.id}`, { display_name: name, category: cat, year, month });
      onSaved(r.data);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed");
      setSaving(false);
    }
  };

  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <h3>Edit Document</h3>
        <div className="field">
          <label>Display name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Category</label>
          <div className="chip-row">
            {Object.keys(CATEGORY_LABELS).map((k) => (
              <button key={k} className={`chip ${cat === k ? "active" : ""}`} onClick={() => setCat(k as any)}>{CATEGORY_LABELS[k]}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Year</label>
          <input className="input" type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value || "0", 10))} />
        </div>
        <div className="field">
          <label>Month</label>
          <div className="chip-row">
            <button className={`chip ${month === null ? "active" : ""}`} onClick={() => setMonth(null)}>None</button>
            {MONTHS.map((m, i) => <button key={i} className={`chip ${month === i + 1 ? "active" : ""}`} onClick={() => setMonth(i + 1)}>{m}</button>)}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "✓ Save"}</button>
        </div>
      </div>
    </div>
  );
}
