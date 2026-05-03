import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, {
  DocumentMeta, fileUrl, bulkDownloadDocs,
  getToken, getUser, UserInfo, initials, colorFromString,
  Category, listCategories, emojiForIcon,
} from "../api";
import { useDocsSocket } from "../useDocsSocket";
import DashboardShell, { NavItem } from "../layout/DashboardShell";

export default function ClientCategoryView() {
  const nav = useNavigate();
  const { adminId } = useParams<{ adminId: string }>();
  const me = getUser();
  const [admin, setAdmin] = useState<UserInfo | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [tabId, setTabId] = useState<string>("");
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Multi-select / bulk-download
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleId = (id: string) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const exitSelectionMode = () => { setSelecting(false); setSelected(new Set()); };

  useEffect(() => {
    if (!getToken() || me?.role !== "client") { nav("/client/login", { replace: true }); return; }
  }, []);

  useEffect(() => {
    if (!adminId) return;
    api.get<any[]>("/admins/connected").then((r) => {
      const a = r.data.find((x) => x.id === adminId); if (a) setAdmin(a);
    });
    listCategories({ admin_id: adminId }).then((list) => {
      setCats(list);
      if (list.length > 0 && !tabId) setTabId(list[0].id);
    }).catch((e) => console.error("load cats", e));
  }, [adminId]);

  const load = async (cId: string) => {
    if (!adminId || !cId) return;
    setLoading(true);
    try {
      const r = await api.get<DocumentMeta[]>("/documents", { params: { category_id: cId, admin_id: adminId } });
      setDocs(r.data);
      const ys = Array.from(new Set(r.data.map((d) => d.year))).sort((a, b) => b - a);
      setYear((prev) => prev && ys.includes(prev) ? prev : (ys[0] ?? null));
    } finally { setLoading(false); }
  };
  useEffect(() => { if (tabId) load(tabId); /* eslint-disable-line */ }, [tabId, adminId]);

  useDocsSocket((e) => {
    if (e.type === "doc:created" || e.type === "doc:updated") {
      if (e.doc?.admin_id === adminId && (e.doc?.category_id === tabId || e.doc?.category === activeCat?.key)) load(tabId);
    } else if (e.type === "doc:deleted") {
      if (e.admin_id === adminId && docs.some((d) => d.id === e.id)) load(tabId);
    } else if (e.type === "category:created" && e.category) {
      setCats((p) => p.some((c) => c.id === e.category.id) ? p : [...p, e.category].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
    } else if (e.type === "category:updated" && e.category) {
      setCats((p) => p.map((c) => (c.id === e.category.id ? e.category : c)));
    } else if (e.type === "category:deleted") {
      setCats((p) => {
        const next = p.filter((c) => c.id !== e.id);
        if (tabId === e.id) setTabId(next[0]?.id || "");
        return next;
      });
    }
  });

  const activeCat = useMemo(() => cats.find((c) => c.id === tabId), [cats, tabId]);
  const years = useMemo(() => Array.from(new Set(docs.map((d) => d.year))).sort((a, b) => b - a), [docs]);
  const filtered = useMemo(() => (year ? docs.filter((d) => d.year === year) : []), [docs, year]);

  // Logout handled by DashboardShell footer.
  const share = async (d: DocumentMeta) => {
    const url = window.location.origin + fileUrl(d.id);
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: d.display_name, text: d.display_name, url });
      else { await navigator.clipboard.writeText(url); alert("Link copied:\n" + url); }
    } catch { /* cancelled */ }
  };

  // Build nav items: Back + categories as nav
  const navItems: NavItem[] = [
    {
      to: "/client",
      label: "← All Admins",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      ),
    },
    ...cats.map<NavItem>((c) => ({
      to: `#cat-${c.id}`,
      label: c.name,
      onPress: () => setTabId(c.id),
      matches: () => tabId === c.id,
      icon: c.custom_icon_b64 ? (
        <img
          src={`data:image/png;base64,${c.custom_icon_b64}`}
          alt=""
          style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover" }}
        />
      ) : (
        <span style={{ fontSize: 18 }}>{emojiForIcon(c.icon)}</span>
      ),
    })),
  ];

  return (
    <DashboardShell
      role="client"
      title="Client Console"
      nav={navItems}
      pageTitle={activeCat ? activeCat.name : "Documents"}
      pageSubtitle={admin ? `${admin.name} · Admin · ${admin.email}` : "Loading admin…"}
      headerAction={
        <div className="ds-client-badge">
          <div
            className="avatar"
            style={{ background: admin ? colorFromString(admin.id) : "#3801FF", width: 36, height: 36 }}
          >
            {admin ? initials(admin.name) : "?"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A" }}>
              {admin?.name || "Loading…"}
            </div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{admin?.email}</div>
          </div>
        </div>
      }
    >
      <div key={tabId}>
        {activeCat && (
          <div className="cat-hero" style={{ background: `linear-gradient(135deg, ${activeCat.color}1a, ${activeCat.color}08)`, borderColor: `${activeCat.color}33` }}>
            <div className="cat-hero-top">
              <div
                className="cat-hero-icon"
                style={{
                  background: activeCat.custom_icon_b64 ? "#fff" : activeCat.color,
                  padding: activeCat.custom_icon_b64 ? 4 : undefined,
                  overflow: "hidden",
                }}
              >
                {activeCat.custom_icon_b64 ? (
                  <img
                    src={`data:image/png;base64,${activeCat.custom_icon_b64}`}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  emojiForIcon(activeCat.icon)
                )}
              </div>
              <div className="cat-hero-count">{docs.length} files</div>
            </div>
            <h2>{activeCat.name}</h2>
            <p>{activeCat.keywords.length > 0 ? `Auto-detected: ${activeCat.keywords.join(", ")}` : "Documents in this category"}</p>
          </div>
        )}

        {loading ? (
          <div><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
        ) : years.length === 0 ? (
          <div className="empty"><div className="empty-icon">📂</div><h3>No documents yet</h3><p>The admin will upload them shortly.</p></div>
        ) : (
          <>
            <div className="chip-row">
              {years.map((y) => <button key={y} className={`chip ${year === y ? "active" : ""}`} onClick={() => setYear(y)}>{y}</button>)}
            </div>
            {filtered.length === 0 ? (
              <div className="empty"><p>No documents for {year}</p></div>
            ) : (
              <>
                <div className="bulk-bar" style={{ marginBottom: 12 }}>
                  {!selecting ? (
                    <>
                      <span className="muted" style={{ flex: 1, fontSize: 13 }}>{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelecting(true)}>☑ Select</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          const all = filtered.every((d) => selected.has(d.id)) && filtered.length > 0;
                          setSelected((p) => {
                            const n = new Set(p);
                            for (const d of filtered) all ? n.delete(d.id) : n.add(d.id);
                            return n;
                          });
                        }}
                      >
                        {filtered.every((d) => selected.has(d.id)) && filtered.length > 0 ? "✕ Deselect all" : "☑ Select all"}
                      </button>
                      <span className="bulk-count">{selected.size} selected</span>
                      <span style={{ flex: 1 }} />
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={selected.size === 0 || bulkBusy}
                        onClick={async () => {
                          if (selected.size === 0) return;
                          setBulkBusy(true);
                          try { await bulkDownloadDocs(Array.from(selected)); exitSelectionMode(); }
                          catch (e: any) { alert(e?.response?.data?.detail || e?.message || "Bulk download failed"); }
                          finally { setBulkBusy(false); }
                        }}
                      >
                        {bulkBusy ? "⏳ Building zip…" : `⬇ Download ZIP (${selected.size})`}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={exitSelectionMode} disabled={bulkBusy}>Cancel</button>
                    </>
                  )}
                </div>
                <div className="doc-grid">
                  {filtered.map((d, i) => {
                    const isSelected = selected.has(d.id);
                    const dispColor = activeCat?.color || "#6B7280";
                    return (
                      <div
                        key={d.id}
                        className={`doc-card ${selecting ? "selecting" : ""} ${isSelected ? "selected" : ""}`}
                        style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                        onClick={selecting ? () => toggleId(d.id) : undefined}
                      >
                        {selecting && (
                          <span className={`doc-checkbox ${isSelected ? "checked" : ""}`} aria-hidden>{isSelected ? "✓" : ""}</span>
                        )}
                        <div className="doc-top">
                          <div
                            className="doc-icon"
                            style={{
                              background: activeCat?.custom_icon_b64 ? "#fff" : `${dispColor}1a`,
                              color: dispColor,
                              borderColor: `${dispColor}33`,
                              padding: activeCat?.custom_icon_b64 ? 0 : undefined,
                              overflow: "hidden",
                            }}
                          >
                            {activeCat?.custom_icon_b64 ? (
                              <img
                                src={`data:image/png;base64,${activeCat.custom_icon_b64}`}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              "📄"
                            )}
                          </div>
                          <div className="doc-meta">
                            <div className="doc-title">{d.display_name}</div>
                            <div className="doc-sub">
                              {d.month_label && <span className="badge">{d.month_label}</span>}
                              <span className="badge year">{d.year}</span>
                              <span>{(d.size / 1024).toFixed(0)} KB</span>
                            </div>
                          </div>
                        </div>
                        {!selecting && (
                          <div className="doc-actions">
                            <button className="act-btn view" onClick={() => window.open(fileUrl(d.id), "_blank")}>👁️ View</button>
                            <button className="act-btn share" onClick={() => share(d)}>⇗ Share</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
