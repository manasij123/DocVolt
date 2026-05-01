import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, getUser } from "../api";

const APK_URL =
  (import.meta.env.VITE_APK_URL as string | undefined) ||
  "https://expo.dev/artifacts/eas/e6jGMGCfQQ1arLMmiJHdaq.apk";
const API = (import.meta.env.VITE_BACKEND_URL as string | undefined) || "";

type PublicStats = {
  admins: number;
  clients: number;
  active_users: number;
  documents: number;
  uptime: string;
};

export default function Landing() {
  const navigate = useNavigate();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u && getToken()) {
      if (u.role === "admin") navigate("/admin", { replace: true });
      else if (u.role === "client") navigate("/client", { replace: true });
    }
  }, [navigate]);

  // fetch real stats for trust section
  useEffect(() => {
    fetch(`${API}/api/stats/public`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats({ admins: 0, clients: 0, active_users: 0, documents: 0, uptime: "99.9%" }));
  }, []);

  const scrollToDashboard = () => {
    document.getElementById("dashboard-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="dv-landing-light">
      {/* ─────── HEADER ─────── */}
      <header className="dv-nav">
        <div className="dv-nav-inner">
          <Link to="/" className="dv-brand">
            <img src="/api/web/logo.png" alt="" className="dv-brand-mark" />
            <img src="/api/web/wordmark.png" alt="DocVault" className="dv-brand-wordmark" />
          </Link>
          <nav className="dv-nav-links">
            <a href="#features">Features</a>
            <a href="#solutions">Solutions</a>
            <a href="#pricing">Pricing</a>
            <a href="#resources">Resources</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="dv-nav-cta">
            <button className="dv-link-btn" onClick={() => setShowRoleModal(true)}>
              Login
            </button>
            <Link to="/client/register" className="dv-gradient-btn">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ─────── HERO ─────── */}
      <section className="dv-hero">
        <div className="dv-hero-grid">
          {/* Left — copy & CTAs */}
          <div className="dv-hero-left">
            <span className="dv-pill">Secure. Organised. Always Accessible.</span>
            <h1 className="dv-hero-h1">
              Organised PDF storage.<br />
              Per-client privacy.<br />
              <span className="dv-grad-text">Real-time sync.</span>
            </h1>
            <p className="dv-hero-sub">
              DocVault helps teams and professionals securely store, organise and share PDFs
              with complete control and peace of mind.
            </p>
            <div className="dv-hero-ctas">
              <Link to="/client/register" className="dv-gradient-btn dv-big">
                Start Free Trial
              </Link>
              <button className="dv-outline-btn dv-big" onClick={scrollToDashboard}>
                ▶ View Demo
              </button>
            </div>
            <div className="dv-hero-badges">
              <span><span className="dv-b-ic">🛡️</span>End-to-end Encrypted</span>
              <span><span className="dv-b-ic">👥</span>Per-client Privacy</span>
              <span><span className="dv-b-ic">↻</span>Real-time Sync</span>
            </div>
            <a href={APK_URL} target="_blank" rel="noopener noreferrer" className="dv-apk-inline">
              📱 Download Android App (.apk)
            </a>
          </div>
          {/* Right — dashboard mockup + 3D logo */}
          <div className="dv-hero-right" id="dashboard-preview">
            <div className="dv-dashboard-card">
              <div className="dv-dash-top">
                <div className="dv-dash-sidebar">
                  <div className="dv-dash-brand">
                    <img src="/api/web/logo.png" alt="" /> DocVault
                  </div>
                  <div className="dv-dash-nav">
                    <div className="active">◉ Dashboard</div>
                    <div>📄 All Documents</div>
                    <div>👥 Shared with me</div>
                    <div>📁 Client Folders</div>
                    <div>🗑️ Trash</div>
                    <div>📊 Activity</div>
                    <div>⚙️ Settings</div>
                  </div>
                </div>
                <div className="dv-dash-main">
                  <div className="dv-dash-header">
                    <strong>Dashboard</strong>
                    <div className="dv-dash-search">🔍 Search documents...</div>
                    <button className="dv-gradient-btn dv-sm">Upload PDF</button>
                  </div>
                  <div className="dv-dash-kpis">
                    <div className="dv-kpi">
                      <small>Storage Overview</small>
                      <div className="dv-kpi-val">128 GB <span>/ 200 GB</span></div>
                      <div className="dv-kpi-bar"><span style={{ width: "64%" }} /></div>
                      <small className="muted">25% used</small>
                    </div>
                    <div className="dv-kpi">
                      <small>Total Documents</small>
                      <div className="dv-kpi-val">1,248</div>
                      <small className="dv-pos">+32 this month</small>
                    </div>
                  </div>
                  <div className="dv-dash-lists">
                    <div className="dv-dash-list">
                      <strong>Recent Documents</strong>
                      {[
                        ["Project Proposal.pdf", "2.4 MB • 2 mins ago"],
                        ["Client Agreement.pdf", "1.8 MB • 15 mins ago"],
                        ["Financial Report.pdf", "3.1 MB • 1 hour ago"],
                        ["Meeting Notes.pdf", "1.2 MB • 3 hours ago"],
                      ].map(([n, m]) => (
                        <div key={n} className="dv-doc-row">
                          <span className="dv-doc-ic">📕</span>
                          <div>
                            <div className="dv-doc-name">{n}</div>
                            <div className="dv-doc-meta">{m}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="dv-dash-list">
                      <strong>Client Folders</strong>
                      {[
                        ["Acme Corporation", "24 documents"],
                        ["Globex Industries", "18 documents"],
                        ["Initech Solutions", "31 documents"],
                      ].map(([n, m]) => (
                        <div key={n} className="dv-doc-row">
                          <span className="dv-doc-ic dv-folder">📁</span>
                          <div>
                            <div className="dv-doc-name">{n}</div>
                            <div className="dv-doc-meta">{m}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <img src="/api/web/logo.png" alt="" className="dv-hero-3d-logo" />
          </div>
        </div>
      </section>

      {/* ─────── FEATURE CARDS ─────── */}
      <section className="dv-features" id="features">
        <div className="dv-features-grid">
          {[
            {
              icon: "🛡️",
              title: "Secure Storage",
              desc: "Bank-level encryption ensures your PDFs are always safe and protected.",
            },
            {
              icon: "👥",
              title: "Per-client Privacy",
              desc: "Keep every client's data separate with isolated workspaces.",
            },
            {
              icon: "↻",
              title: "Real-time Sync",
              desc: "Access, update and share documents in real-time across devices.",
            },
            {
              icon: "📁",
              title: "Smart Organisation",
              desc: "Organise with folders, tags and powerful search for instant access.",
            },
          ].map((f) => (
            <div key={f.title} className="dv-feat-card">
              <div className="dv-feat-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────── TRUST / STATS ─────── */}
      <section className="dv-trust" id="solutions">
        <div className="dv-trust-grid">
          <div className="dv-trust-left">
            <span className="dv-pill dv-pill-light">Trusted by professionals</span>
            <h2>Built for teams who<br />value security and clarity.</h2>
            <p>
              Join {stats && stats.active_users > 0 ? "the early" : "the growing community of"} businesses
              that trust DocVault for their document management.
            </p>
          </div>
          <div className="dv-trust-stats">
            <div className="dv-stat">
              <div className="dv-stat-ic">👥</div>
              <div className="dv-stat-num">
                {stats ? stats.active_users.toLocaleString() : "—"}
                {stats && stats.active_users >= 10 ? "+" : ""}
              </div>
              <div className="dv-stat-lbl">Active Users</div>
            </div>
            <div className="dv-stat">
              <div className="dv-stat-ic">📄</div>
              <div className="dv-stat-num">
                {stats ? stats.documents.toLocaleString() : "—"}
                {stats && stats.documents >= 10 ? "+" : ""}
              </div>
              <div className="dv-stat-lbl">Documents Stored</div>
            </div>
            <div className="dv-stat">
              <div className="dv-stat-ic">◇</div>
              <div className="dv-stat-num">{stats ? stats.uptime : "—"}</div>
              <div className="dv-stat-lbl">Uptime</div>
            </div>
          </div>
          <img src="/api/web/logo.png" alt="" className="dv-trust-logo" />
        </div>
      </section>

      {/* ─────── FOOTER ─────── */}
      <footer className="dv-footer" id="contact">
        <div className="dv-footer-grid">
          <div className="dv-footer-brand">
            <img src="/api/web/wordmark.png" alt="DocVault" className="dv-foot-wordmark" />
            <p>
              Secure PDF storage for modern businesses.<br />
              Organised. Private. Always in sync.
            </p>
          </div>
          <div className="dv-foot-col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#resources">Changelog</a>
          </div>
          <div className="dv-foot-col">
            <h4>Solutions</h4>
            <a href="#solutions">For Teams</a>
            <a href="#solutions">For Agencies</a>
            <a href="#solutions">For Professionals</a>
          </div>
          <div className="dv-foot-col">
            <h4>Resources</h4>
            <a href="#resources">Help Center</a>
            <a href="#resources">Documentation</a>
            <a href="#resources">Blog</a>
          </div>
          <div className="dv-foot-col">
            <h4>Company</h4>
            <a href="#contact">About Us</a>
            <a href="#contact">Contact</a>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </div>
        <div className="dv-footer-bottom">
          <span>© 2026 DocVault. All rights reserved.</span>
          <span>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </span>
        </div>
      </footer>

      {/* ─────── ROLE SELECTOR MODAL ─────── */}
      {showRoleModal && (
        <div className="dv-modal-back" onClick={() => setShowRoleModal(false)}>
          <div className="dv-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dv-modal-close" onClick={() => setShowRoleModal(false)}>✕</button>
            <h3>Sign in to DocVault</h3>
            <p className="muted">Choose your account type to continue</p>
            <div className="dv-role-grid">
              <Link to="/client/login" className="dv-role-card">
                <span className="dv-role-ic">👤</span>
                <strong>I'm a Client</strong>
                <small>Access documents shared with you</small>
              </Link>
              <Link to="/admin/login" className="dv-role-card">
                <span className="dv-role-ic">🛡️</span>
                <strong>I'm an Admin</strong>
                <small>Manage clients & documents</small>
              </Link>
              <Link to="/superadmin/login" className="dv-role-card dv-role-admin">
                <span className="dv-role-ic">👑</span>
                <strong>Super Admin</strong>
                <small>System overview & monitoring</small>
              </Link>
            </div>
            <div className="dv-modal-foot muted">
              New to DocVault?{" "}
              <Link to="/client/register" onClick={() => setShowRoleModal(false)}>Create account</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
