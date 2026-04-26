import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, {
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  DocumentMeta,
  fileUrl,
  getToken,
  setRole,
  setToken,
} from "../api";
import { useDocsSocket } from "../useDocsSocket";
import LiveBadge from "../LiveBadge";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const CATEGORY_KEYS = ["MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"] as const;

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
      let y = parseInt(m[2], 10);
      if (y < 100) y += 2000;
      return { month: MONTH_MAP[ms], year: y };
    }
  }
  const ym = n.match(/\b(20\d{2})\b/);
  return ym ? { month: null, year: parseInt(ym[1], 10) } : { month: null, year: null };
}

/* ─── Toast types & helpers ──────────────────────────────────── */
type Toast = { id: string; kind: "created" | "updated" | "deleted"; title: string; sub?: string; leaving?: boolean };

export default function AdminDashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"upload" | "manage">("upload");
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [editing, setEditing] = useState<DocumentMeta | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Auth gate
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

  // ── Live updates: keep doc list and toasts in sync without refresh ──
  const pushToast = (t: Omit<Toast, "id">) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 5);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 320);
    }, 3200);
  };

  useDocsSocket((e) => {
    if (e.type === "doc:created") {
      setDocs((prev) => (prev.some((d) => d.id === e.doc.id) ? prev : [e.doc, ...prev]));
      pushToast({ kind: "created", title: "New file added", sub: e.doc.display_name });
    } else if (e.type === "doc:updated") {
      setDocs((prev) => prev.map((d) => (d.id === e.doc.id ? e.doc : d)));
      pushToast({ kind: "updated", title: "File updated", sub: e.doc.display_name });
    } else if (e.type === "doc:deleted") {
      setDocs((prev) => {
        const removed = prev.find((d) => d.id === e.id);
        if (removed) pushToast({ kind: "deleted", title: "File removed", sub: removed.display_name });
        return prev.filter((d) => d.id !== e.id);
      });
    }
  });

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
            <LiveBadge />
            <button
              className="btn btn-sm"
              style={{ background: "rgba(255,255,255,0.10)", color: "#fff", borderRadius: 9, padding: "8px 14px" }}
              onClick={onLogout}
            >
              Logout ↪
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")}>📤 Upload</button>
          <button className={`admin-tab ${tab === "manage" ? "active" : ""}`} onClick={() => { setTab("manage"); reload(); }}>⚙️ Manage</button>
        </div>
      </div>

      <main className="container page-anim" style={{ padding: "20px 24px 60px" }} key={tab}>
        {tab === "upload" ? (
          <UploadPanel onUploaded={() => { reload(); }} />
        ) : (
          <ManagePanel docs={docs} setDocs={setDocs} filter={filter} setFilter={setFilter} setEditing={setEditing} />
        )}
      </main>

      {editing && (
        <EditModal
          doc={editing}
          onClose={() => setEditing(null)}
          onSaved={(d) => {
            setDocs((prev) => prev.map((x) => (x.id === d.id ? d : x)));
            setEditing(null);
          }}
        />
      )}

      {/* Live toasts */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind} ${t.leaving ? "leaving" : ""}`}>
            <span className="dot" />
            <div className="body">
              <strong>{t.title}</strong>
              {t.sub && <small>{t.sub}</small>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Upload Panel ─────────────────────────────────────────── */
function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const reset = () => {
    setPicked(null);
    setStage("idle");
    setErr(null);
    setDone(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const acceptFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setErr("Please choose a PDF file.");
      return;
    }
    setPicked(f);
    const c = detectCategory(f.name);
    const my = detectMonthYear(f.name);
    setDetCat(c); setDetYear(my.year); setDetMonth(my.month);
    setCat(c); if (my.year) setYear(my.year); setMonth(my.month);
    setStage("scanned"); setDone(null); setErr(null);
  };

  const onFile = (f: File | null) => { if (f) acceptFile(f); };

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
      reset();
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
      <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.4 }}>Upload PDF</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
        Pick or drop a PDF — DocVault will scan its filename and tell you which tab/year/month it belongs to.
      </p>

      {done && <div className="banner success">✓ Uploaded: {done}</div>}
      {err && <div className="banner error">⚠ {err}</div>}

      <div
        className={`dropzone ${drag ? "drag" : ""} ${picked ? "has-file" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) acceptFile(f);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
      >
        <div className="dropzone-icon">📄</div>
        <div className="dropzone-title">{picked ? picked.name : "Tap or drop a PDF here"}</div>
        <div className="dropzone-sub">
          {picked ? `${(picked.size / 1024).toFixed(0)} KB · Tap to change` : "PDF only"}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
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
            <div className="detect-row"><span className="lbl">Tab</span> <span className={`val ${detCat === "OTHERS" ? "warn" : ""}`}>{CATEGORY_LABELS[detCat]}</span></div>
            <div className="detect-row"><span className="lbl">Year</span> <span className={`val ${!detYear ? "warn" : ""}`}>{detYear ?? "—"}</span></div>
            <div className="detect-row"><span className="lbl">Month</span> <span className={`val ${!detMonth ? "warn" : ""}`}>{detMonth ? MONTHS[detMonth - 1] : "—"}</span></div>
          </div>
          <div className="detect-q">Is this format correct?</div>
          <div className="detect-actions">
            <button className="btn btn-danger" onClick={reset} disabled={uploading}>✕ Cancel</button>
            <button className="btn btn-ghost" onClick={() => setStage("manual")} disabled={uploading}>✎ No, manual</button>
            <button className="btn btn-primary" onClick={() => send(detCat, detYear ?? new Date().getFullYear(), detMonth)} disabled={uploading}>
              {uploading ? "Uploading…" : "✓ Yes, upload"}
            </button>
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
          <div className="detect-actions" style={{ marginTop: 22 }}>
            <button className="btn btn-danger" onClick={reset} disabled={uploading}>✕ Cancel</button>
            <button className="btn btn-ghost" onClick={() => setStage("scanned")} disabled={uploading}>← Back</button>
            <button className="btn btn-primary" onClick={() => send(cat, year, month)} disabled={uploading}>
              {uploading ? "Uploading…" : "📤 Upload"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Manage Panel ─────────────────────────────────────────── */
function ManagePanel({
  docs,
  setDocs,
  filter,
  setFilter,
  setEditing,
}: {
  docs: DocumentMeta[];
  setDocs: (d: DocumentMeta[]) => void;
  filter: string;
  setFilter: (f: string) => void;
  setEditing: (d: DocumentMeta | null) => void;
}) {
  const onDelete = async (d: DocumentMeta) => {
    if (!window.confirm(`Delete "${d.display_name}"?`)) return;
    try {
      await api.delete(`/documents/${d.id}`);
      setDocs(docs.filter((x) => x.id !== d.id));
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Delete failed");
    }
  };

  // ─── Build groups for "ALL" view (one section per category) ───
  const grouped = useMemo(() => {
    const g: Record<string, DocumentMeta[]> = {
      MONTHLY_RETURN: [],
      FORWARDING_LETTER: [],
      IFA_REPORT: [],
      OTHERS: [],
    };
    for (const d of docs) (g[d.category] ?? g.OTHERS).push(d);
    return g;
  }, [docs]);

  const filtered = filter === "ALL" ? docs : docs.filter((d) => d.category === filter);

  const renderCard = (d: DocumentMeta, i: number) => (
    <div key={d.id} className="doc-card" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
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
      <div className="doc-actions">
        <button className="act-btn view" onClick={() => window.open(fileUrl(d.id), "_blank")}>👁️ View</button>
        <button className="act-btn edit" onClick={() => setEditing(d)}>✎ Edit</button>
        <button className="act-btn delete" onClick={() => onDelete(d)}>🗑 Delete</button>
      </div>
    </div>
  );

  return (
    <>
      <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.4 }}>Manage Documents</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>{docs.length} total</p>

      <div className="tab-row">
        {["ALL", "MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"].map((k) => (
          <button key={k} className={`tab ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
            {k === "ALL" ? "All" : `${CATEGORY_ICONS[k]} ${CATEGORY_LABELS[k]}`}
          </button>
        ))}
      </div>

      {docs.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📂</div>
          <h3>No documents yet</h3>
          <p>Upload your first PDF from the Upload tab.</p>
        </div>
      ) : filter === "ALL" ? (
        // ── Grouped view: one section per category with heading ──
        <>
          {CATEGORY_KEYS.map((k) => {
            const items = grouped[k];
            if (!items.length) return null;
            return (
              <section key={k}>
                <div className="section-head">
                  <span className={`section-dot ${k}`} />
                  <span className="section-title">{CATEGORY_LABELS[k]}</span>
                  <span className="section-count">· {items.length}</span>
                </div>
                <div className="doc-grid">{items.map((d, i) => renderCard(d, i))}</div>
              </section>
            );
          })}
        </>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📂</div>
          <h3>No documents in this category</h3>
        </div>
      ) : (
        <div className="doc-grid">{filtered.map((d, i) => renderCard(d, i))}</div>
      )}
    </>
  );
}

/* ─── Edit Modal ───────────────────────────────────────────── */
function EditModal({ doc, onClose, onSaved }: { doc: DocumentMeta; onClose: () => void; onSaved: (d: DocumentMeta) => void }) {
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
    <div
      className="modal-back"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
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
              <button key={k} className={`chip ${cat === k ? "active" : ""}`} onClick={() => setCat(k as any)}>
                {CATEGORY_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Year</label>
          <input
            className="input"
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value || "0", 10))}
          />
        </div>
        <div className="field">
          <label>Month</label>
          <div className="chip-row">
            <button className={`chip ${month === null ? "active" : ""}`} onClick={() => setMonth(null)}>None</button>
            {MONTHS.map((m, i) => (
              <button key={i} className={`chip ${month === i + 1 ? "active" : ""}`} onClick={() => setMonth(i + 1)}>{m}</button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "✓ Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
