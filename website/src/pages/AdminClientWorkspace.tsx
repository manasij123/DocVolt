import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, {
  CATEGORY_LABELS, CATEGORY_ICONS, DocumentMeta, fileUrl, bulkDownloadDocs,
  getToken, getUser, logout, UserInfo, initials, colorFromString,
} from "../api";
import { useDocsSocket } from "../useDocsSocket";
import LiveBadge from "../LiveBadge";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_MAP: Record<string, number> = {
  jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,
  jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12,
};
const CATEGORY_KEYS = ["MONTHLY_RETURN","FORWARDING_LETTER","IFA_REPORT","OTHERS"] as const;

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
  let m: RegExpExecArray | null;
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

export default function AdminClientWorkspace() {
  const nav = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const me = getUser();
  const [client, setClient] = useState<UserInfo | null>(null);
  const [tab, setTab] = useState<"upload" | "manage">("upload");
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [editing, setEditing] = useState<DocumentMeta | null>(null);

  useEffect(() => {
    if (!getToken() || me?.role !== "admin") { nav("/admin/login", { replace: true }); return; }
  }, []);

  useEffect(() => {
    if (!clientId) return;
    api.get<any[]>("/clients").then((r) => {
      const found = r.data.find((c) => c.id === clientId);
      if (found) setClient(found);
    });
    reload();
  }, [clientId]);

  const reload = async () => {
    if (!clientId) return;
    const r = await api.get<DocumentMeta[]>("/documents", { params: { client_id: clientId } });
    setDocs(r.data);
  };

  // Real-time: only react to events for THIS (admin, client) pair
  useDocsSocket((e) => {
    if (e.type === "doc:created" && e.doc?.client_id === clientId) {
      setDocs((p) => p.some((d) => d.id === e.doc.id) ? p : [e.doc, ...p]);
    } else if (e.type === "doc:updated" && e.doc?.client_id === clientId) {
      setDocs((p) => p.map((d) => (d.id === e.doc.id ? e.doc : d)));
    } else if (e.type === "doc:deleted" && e.client_id === clientId) {
      setDocs((p) => p.filter((d) => d.id !== e.id));
    }
  });

  const onLogout = () => { logout(); nav("/", { replace: true }); };

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

      <div className="container" style={{ paddingTop: 18 }}>
        <Link to="/admin" className="crumb-link">← All clients</Link>
        <div className="client-banner">
          <div className="avatar lg" style={{ background: client ? colorFromString(client.id) : "#1A73E8" }}>{client ? initials(client.name) : "?"}</div>
          <div>
            <div className="client-banner-name">{client?.name || "Loading…"}</div>
            <div className="client-banner-email">{client?.email}</div>
          </div>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")}>📤 Upload</button>
          <button className={`admin-tab ${tab === "manage" ? "active" : ""}`} onClick={() => { setTab("manage"); reload(); }}>⚙️ Manage</button>
        </div>
      </div>

      <main className="container page-anim" style={{ padding: "20px 24px 60px" }} key={tab}>
        {tab === "upload"
          ? <UploadPanel clientId={clientId!} onUploaded={reload} />
          : <ManagePanel docs={docs} setDocs={setDocs} filter={filter} setFilter={setFilter} setEditing={setEditing} />}
      </main>

      {editing && (
        <EditModal doc={editing} onClose={() => setEditing(null)} onSaved={(d) => {
          setDocs((p) => p.map((x) => (x.id === d.id ? d : x))); setEditing(null);
        }} />
      )}
    </div>
  );
}

function UploadPanel({ clientId, onUploaded }: { clientId: string; onUploaded: () => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "scanned" | "manual">("idle");
  const [drag, setDrag] = useState(false);
  const [detCat, setDetCat] = useState("OTHERS");
  const [detYear, setDetYear] = useState<number | null>(null);
  const [detMonth, setDetMonth] = useState<number | null>(null);
  const [cat, setCat] = useState("OTHERS");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ---- Bulk-upload state ----
  type BulkRow = {
    id: string;
    file: File;
    category: string;
    year: number;
    month: number | null;
    status: "pending" | "uploading" | "done" | "error";
    progress: number;          // 0-100
    errorMsg?: string;
    resultName?: string;
  };
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const reset = () => {
    setPicked(null); setStage("idle"); setErr(null); setDone(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const acceptFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) { setErr("Please choose a PDF file."); return; }
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
      fd.append("client_id", clientId);
      fd.append("category_override", cTo);
      fd.append("year_override", String(yTo));
      if (mTo !== null) fd.append("month_override", String(mTo));
      const r = await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDone(r.data.display_name); reset(); onUploaded();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
  };

  const looksGood = detCat !== "OTHERS" && detYear !== null && detMonth !== null;
  const yrs = [year - 2, year - 1, year, year + 1];

  // ---- Bulk-upload helpers ----
  const onBulkPick = (files: FileList | null) => {
    if (!files || !files.length) return;
    const next: BulkRow[] = [];
    for (const f of Array.from(files)) {
      if (!f.name.toLowerCase().endsWith(".pdf")) continue;
      // Skip duplicates (same name + size already queued)
      if (bulkRows.some((b) => b.file.name === f.name && b.file.size === f.size)) continue;
      const c = detectCategory(f.name);
      const my = detectMonthYear(f.name);
      next.push({
        id: Math.random().toString(36).slice(2),
        file: f,
        category: c,
        year: my.year ?? new Date().getFullYear(),
        month: my.month,
        status: "pending",
        progress: 0,
      });
    }
    if (next.length === 0) return;
    setBulkRows((prev) => [...prev, ...next]);
    if (bulkInputRef.current) bulkInputRef.current.value = "";
  };

  const uploadAll = async () => {
    setBulkBusy(true);
    // Snapshot the indices we need to upload so progress updates don't race.
    const queueIndices: number[] = [];
    bulkRows.forEach((b, i) => { if (b.status === "pending" || b.status === "error") queueIndices.push(i); });
    for (const i of queueIndices) {
      // Read fresh row each iteration (in case state was updated)
      let row: BulkRow | undefined;
      setBulkRows((prev) => {
        row = prev[i];
        return prev.map((b, idx) => idx === i ? { ...b, status: "uploading", progress: 0, errorMsg: undefined } : b);
      });
      if (!row) continue;
      try {
        const fd = new FormData();
        fd.append("file", row.file);
        fd.append("client_id", clientId);
        fd.append("category_override", row.category);
        fd.append("year_override", String(row.year));
        if (row.month !== null) fd.append("month_override", String(row.month));
        const resp = await api.post("/documents/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setBulkRows((prev) => prev.map((b, idx) => idx === i ? { ...b, progress: pct } : b));
          },
        });
        const display = resp.data?.display_name || row.file.name;
        setBulkRows((prev) => prev.map((b, idx) => idx === i ? { ...b, status: "done", progress: 100, resultName: display } : b));
      } catch (e: any) {
        setBulkRows((prev) => prev.map((b, idx) => idx === i ? { ...b, status: "error", errorMsg: e?.response?.data?.detail || "Upload failed" } : b));
      }
    }
    setBulkBusy(false);
    onUploaded(); // refresh document list once everything is done
  };

  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Upload PDF</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>Filename will be auto-categorised. Documents go only to this client.</p>
      {done && <div className="banner success">✓ Uploaded: {done}</div>}
      {err && <div className="banner error">⚠ {err}</div>}
      <div className={`dropzone ${drag ? "drag" : ""} ${picked ? "has-file" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) acceptFile(f); }}
        role="button" tabIndex={0}>
        <div className="dropzone-icon">📄</div>
        <div className="dropzone-title">{picked ? picked.name : "Tap or drop a PDF here"}</div>
        <div className="dropzone-sub">{picked ? `${(picked.size / 1024).toFixed(0)} KB · Tap to change` : "PDF only"}</div>
        <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} />
      </div>

      {stage === "scanned" && picked && (
        <div className="detect-card">
          <div className="detect-head">
            <div className={`detect-badge ${looksGood ? "ok" : "warn"}`}>{looksGood ? "✓" : "!"}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{looksGood ? "Filename matched" : "Format unclear"}</div>
              <div className="muted">{looksGood ? "Auto-detected from filename" : "Some details missing"}</div>
            </div>
          </div>
          <div className="detect-table">
            <div className="detect-row"><span className="lbl">Tab</span><span className={`val ${detCat === "OTHERS" ? "warn" : ""}`}>{CATEGORY_LABELS[detCat]}</span></div>
            <div className="detect-row"><span className="lbl">Year</span><span className={`val ${!detYear ? "warn" : ""}`}>{detYear ?? "—"}</span></div>
            <div className="detect-row"><span className="lbl">Month</span><span className={`val ${!detMonth ? "warn" : ""}`}>{detMonth ? MONTHS[detMonth - 1] : "—"}</span></div>
          </div>
          <div className="detect-q">Is this format correct?</div>
          <div className="detect-actions">
            <button className="btn btn-danger" onClick={reset} disabled={uploading}>✕ Cancel</button>
            <button className="btn btn-ghost" onClick={() => setStage("manual")} disabled={uploading}>✎ No, manual</button>
            <button className="btn btn-primary" onClick={() => send(detCat, detYear ?? new Date().getFullYear(), detMonth)} disabled={uploading}>{uploading ? "Uploading…" : "✓ Yes, upload"}</button>
          </div>
        </div>
      )}
      {stage === "manual" && picked && (
        <div className="detect-card">
          <h3 style={{ marginTop: 0 }}>Set category & date manually</h3>
          <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12, marginBottom: 8 }}>Category</div>
          <div className="chip-row">{Object.keys(CATEGORY_LABELS).map((k) => (
            <button key={k} className={`chip ${cat === k ? "active" : ""}`} onClick={() => setCat(k)}>{CATEGORY_LABELS[k]}</button>
          ))}</div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12, marginBottom: 8 }}>Year</div>
          <div className="chip-row">{yrs.map((y) => <button key={y} className={`chip ${year === y ? "active" : ""}`} onClick={() => setYear(y)}>{y}</button>)}</div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12, marginBottom: 8 }}>Month</div>
          <div className="chip-row">
            <button className={`chip ${month === null ? "active" : ""}`} onClick={() => setMonth(null)}>None</button>
            {MONTHS.map((m, i) => <button key={i} className={`chip ${month === i + 1 ? "active" : ""}`} onClick={() => setMonth(i + 1)}>{m}</button>)}
          </div>
          <div className="detect-actions" style={{ marginTop: 22 }}>
            <button className="btn btn-danger" onClick={reset} disabled={uploading}>✕ Cancel</button>
            <button className="btn btn-ghost" onClick={() => setStage("scanned")} disabled={uploading}>← Back</button>
            <button className="btn btn-primary" onClick={() => send(cat, year, month)} disabled={uploading}>{uploading ? "Uploading…" : "📤 Upload"}</button>
          </div>
        </div>
      )}

      {/* ============================================================
       *  Bulk upload — pick several PDFs at once and queue them.
       *  Each file shows its auto-detected category + month/year and a
       *  per-file progress bar; uploads happen sequentially.
       * ============================================================ */}
      <div className="bulk-upload-section">
        <div className="bulk-upload-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>📦 Or upload multiple PDFs at once</h3>
            <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>
              Pick several files; each is auto-categorised by filename. Per-file progress shown below.
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => bulkInputRef.current?.click()}
            disabled={bulkBusy}
          >
            ＋ Add files
          </button>
        </div>
        <input
          ref={bulkInputRef}
          type="file"
          accept="application/pdf"
          multiple
          style={{ display: "none" }}
          onChange={(e) => onBulkPick(e.target.files)}
        />
        {bulkRows.length === 0 ? (
          <div className="bulk-empty">No files queued — tap "Add files" to pick multiple PDFs at once.</div>
        ) : (
          <>
            <div className="bulk-list">
              {bulkRows.map((b) => (
                <div key={b.id} className={`bulk-row status-${b.status}`}>
                  <div className="bulk-row-icon">📄</div>
                  <div className="bulk-row-meta">
                    <div className="bulk-row-name" title={b.file.name}>{b.file.name}</div>
                    <div className="bulk-row-sub">
                      <span className="badge">{CATEGORY_LABELS[b.category]}</span>
                      {b.month && <span className="badge">{MONTHS[b.month - 1]}</span>}
                      <span className="badge year">{b.year}</span>
                      <span>{(b.file.size / 1024).toFixed(0)} KB</span>
                    </div>
                    {b.status === "uploading" && (
                      <div className="bulk-row-bar">
                        <div className="bulk-row-bar-fill" style={{ width: `${b.progress}%` }} />
                      </div>
                    )}
                    {b.status === "error" && b.errorMsg && (
                      <div className="bulk-row-err">⚠ {b.errorMsg}</div>
                    )}
                    {b.status === "done" && (
                      <div className="bulk-row-done">✓ Uploaded {b.resultName ? `as "${b.resultName}"` : ""}</div>
                    )}
                  </div>
                  <div className="bulk-row-status">
                    {b.status === "pending" && <span className="bulk-pill pending">Pending</span>}
                    {b.status === "uploading" && <span className="bulk-pill uploading">{b.progress}%</span>}
                    {b.status === "done" && <span className="bulk-pill done">Done</span>}
                    {b.status === "error" && <span className="bulk-pill error">Failed</span>}
                  </div>
                  {!bulkBusy && b.status !== "uploading" && (
                    <button
                      type="button"
                      className="bulk-row-x"
                      title="Remove from queue"
                      onClick={() => setBulkRows((prev) => prev.filter((x) => x.id !== b.id))}
                    >×</button>
                  )}
                </div>
              ))}
            </div>
            <div className="bulk-upload-actions">
              {!bulkBusy && bulkRows.some((b) => b.status === "done") && (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => setBulkRows([])}
                >Clear all</button>
              )}
              <span style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 13 }}>
                {bulkRows.filter((b) => b.status === "done").length}/{bulkRows.length} uploaded
              </span>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={bulkBusy || !bulkRows.some((b) => b.status === "pending" || b.status === "error")}
                onClick={uploadAll}
              >
                {bulkBusy ? "⏳ Uploading…" : `📤 Upload all (${bulkRows.filter((b) => b.status === "pending" || b.status === "error").length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ManagePanel({ docs, setDocs, filter, setFilter, setEditing }: {
  docs: DocumentMeta[]; setDocs: (d: DocumentMeta[]) => void;
  filter: string; setFilter: (f: string) => void; setEditing: (d: DocumentMeta | null) => void;
}) {
  // ===== Multi-select / bulk-download state =====
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleId = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const exitSelectionMode = () => { setSelecting(false); setSelected(new Set()); };

  const onDelete = async (d: DocumentMeta) => {
    if (!window.confirm(`Delete "${d.display_name}"?`)) return;
    try { await api.delete(`/documents/${d.id}`); setDocs(docs.filter((x) => x.id !== d.id)); }
    catch (e: any) { alert(e?.response?.data?.detail || "Delete failed"); }
  };
  const grouped = useMemo(() => {
    const g: Record<string, DocumentMeta[]> = { MONTHLY_RETURN: [], FORWARDING_LETTER: [], IFA_REPORT: [], OTHERS: [] };
    for (const d of docs) (g[d.category] ?? g.OTHERS).push(d);
    return g;
  }, [docs]);
  const filtered = filter === "ALL" ? docs : docs.filter((d) => d.category === filter);
  const visibleIds = useMemo(() => filtered.map((d) => d.id), [filtered]);
  const allSelectedInView = selecting && visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectAllInView = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedInView) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };
  const startBulkDownload = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await bulkDownloadDocs(Array.from(selected));
      exitSelectionMode();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Bulk download failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const renderCard = (d: DocumentMeta, i: number) => {
    const isSelected = selected.has(d.id);
    return (
      <div
        key={d.id}
        className={`doc-card ${selecting ? "selecting" : ""} ${isSelected ? "selected" : ""}`}
        style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
        onClick={selecting ? () => toggleId(d.id) : undefined}
      >
        {selecting && (
          <span className={`doc-checkbox ${isSelected ? "checked" : ""}`} aria-hidden>
            {isSelected ? "✓" : ""}
          </span>
        )}
        <div className="doc-top">
          <div className={`doc-icon ${d.category}`}>📄</div>
          <div className="doc-meta">
            <div className="doc-title">{d.display_name}</div>
            <div className="doc-sub">
              <span className="badge">{CATEGORY_LABELS[d.category]}</span>
              {d.month_label && <span className="badge">{d.month_label}</span>}
              <span className="badge year">{d.year}</span>
              <span>{(d.size / 1024).toFixed(0)} KB</span>
            </div>
          </div>
        </div>
        {!selecting && (
          <div className="doc-actions">
            <button className="act-btn view" onClick={() => window.open(fileUrl(d.id), "_blank")}>👁️ View</button>
            <button className="act-btn edit" onClick={() => setEditing(d)}>✎ Edit</button>
            <button className="act-btn delete" onClick={() => onDelete(d)}>🗑 Delete</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Manage Documents</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>{docs.length} total · only this client</p>
        </div>
        {!selecting && docs.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSelecting(true)} title="Select multiple documents">
            ☑ Select
          </button>
        )}
      </div>
      {selecting && (
        <div className="bulk-bar">
          <button className="btn btn-ghost btn-sm" onClick={selectAllInView}>
            {allSelectedInView ? "✕ Deselect all" : "☑ Select all"}
          </button>
          <span className="bulk-count">{selected.size} selected</span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" disabled={selected.size === 0 || bulkBusy} onClick={startBulkDownload}>
            {bulkBusy ? "⏳ Building zip…" : `⬇ Download ZIP (${selected.size})`}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exitSelectionMode} disabled={bulkBusy}>Cancel</button>
        </div>
      )}
      <div style={{ height: 14 }} />
      <div className="tab-row">
        {["ALL", "MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"].map((k) => (
          <button key={k} className={`tab ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
            {k === "ALL" ? "All" : `${CATEGORY_ICONS[k]} ${CATEGORY_LABELS[k]}`}
          </button>
        ))}
      </div>
      {docs.length === 0 ? (
        <div className="empty"><div className="empty-icon">📂</div><h3>No documents yet</h3><p>Upload from the Upload tab.</p></div>
      ) : filter === "ALL" ? (
        <>{CATEGORY_KEYS.map((k) => {
          const items = grouped[k]; if (!items.length) return null;
          return (
            <section key={k}>
              <div className="section-head"><span className={`section-dot ${k}`} /><span className="section-title">{CATEGORY_LABELS[k]}</span><span className="section-count">· {items.length}</span></div>
              <div className="doc-grid">{items.map((d, i) => renderCard(d, i))}</div>
            </section>
          );
        })}</>
      ) : filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">📂</div><h3>No documents in this category</h3></div>
      ) : (
        <div className="doc-grid">{filtered.map((d, i) => renderCard(d, i))}</div>
      )}
    </>
  );
}

function EditModal({ doc, onClose, onSaved }: { doc: DocumentMeta; onClose: () => void; onSaved: (d: DocumentMeta) => void }) {
  const [name, setName] = useState(doc.display_name);
  const [cat, setCat] = useState(doc.category);
  const [year, setYear] = useState(doc.year);
  const [month, setMonth] = useState<number | null>(doc.month);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { const r = await api.put(`/documents/${doc.id}`, { display_name: name, category: cat, year, month }); onSaved(r.data); }
    catch (e: any) { alert(e?.response?.data?.detail || "Save failed"); setSaving(false); }
  };
  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <h3>Edit Document</h3>
        <div className="field"><label>Display name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Category</label>
          <div className="chip-row">{Object.keys(CATEGORY_LABELS).map((k) => (
            <button key={k} className={`chip ${cat === k ? "active" : ""}`} onClick={() => setCat(k as any)}>{CATEGORY_LABELS[k]}</button>
          ))}</div>
        </div>
        <div className="field"><label>Year</label><input className="input" type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value || "0", 10))} /></div>
        <div className="field"><label>Month</label>
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
