import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  DocumentMeta,
  fileUrl,
  setRole,
} from "../api";

const TAB_ORDER = ["MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"] as const;
type Tab = (typeof TAB_ORDER)[number];

export default function ClientView() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("MONTHLY_RETURN");
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (cat: Tab) => {
    setLoading(true);
    try {
      const r = await api.get<DocumentMeta[]>("/documents", { params: { category: cat } });
      setDocs(r.data);
      const ys = Array.from(new Set(r.data.map((d) => d.year))).sort((a, b) => b - a);
      setYear(ys[0] ?? null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(tab); }, [tab]);

  const years = Array.from(new Set(docs.map((d) => d.year))).sort((a, b) => b - a);
  const filtered = year ? docs.filter((d) => d.year === year) : [];

  const onSwitch = () => {
    setRole(null);
    nav("/", { replace: true });
  };

  const share = async (d: DocumentMeta) => {
    const url = window.location.origin + fileUrl(d.id);
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: d.display_name, text: d.display_name, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard:\n" + url);
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand"><div className="brand-mark">DV</div> DocVault</div>
          <div className="topbar-actions">
            <button className="icon-btn" title="Switch role" onClick={onSwitch}>⇄</button>
            <button className="icon-btn" title="Admin" onClick={() => nav("/admin/login")}>🔒</button>
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: "18px 24px 60px" }}>
        <div className="tab-row">
          {TAB_ORDER.map((c) => (
            <button key={c} className={`tab ${tab === c ? "active" : ""}`} onClick={() => setTab(c)}>
              {CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div className={`cat-hero ${tab}`}>
          <div className="cat-hero-top">
            <div className="cat-hero-icon">{CATEGORY_ICONS[tab]}</div>
            <div className="cat-hero-count">{docs.length} files</div>
          </div>
          <h2>{CATEGORY_LABELS[tab]}</h2>
          <p>{CATEGORY_DESCRIPTIONS[tab]}</p>
        </div>

        {loading ? (
          <div className="center" style={{ padding: 60 }}><div className="spinner" /></div>
        ) : years.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📂</div>
            <h3>No documents yet</h3>
            <p>The admin will upload them shortly.</p>
          </div>
        ) : (
          <>
            <div className="chip-row">
              {years.map((y) => (
                <button key={y} className={`chip ${year === y ? "active" : ""}`} onClick={() => setYear(y)}>{y}</button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="empty"><p>No documents for {year}</p></div>
            ) : (
              <div className="doc-grid">
                {filtered.map((d) => (
                  <div key={d.id} className="doc-card">
                    <div className={`doc-icon ${d.category}`}>📄</div>
                    <div className="doc-meta">
                      <div className="doc-title">{d.display_name}</div>
                      <div className="doc-sub">
                        {d.month_label && <span>{d.month_label}</span>}
                        <span className="status-pill" style={{ color: "#1A73E8" }}>{d.year}</span>
                        <span>{(d.size / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                    <div className="doc-actions">
                      <button className="act-btn view" title="Open" onClick={() => window.open(fileUrl(d.id), "_blank")}>↗</button>
                      <button className="act-btn share" title="Share" onClick={() => share(d)}>↗</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
