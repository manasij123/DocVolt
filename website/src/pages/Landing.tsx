import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, getUser } from "../api";

const APK_URL =
  (import.meta.env.VITE_APK_URL as string | undefined) ||
  "https://expo.dev/artifacts/eas/e6jGMGCfQQ1arLMmiJHdaq.apk";

// Only this specific account gets the Super Admin entry visible permanently
// (besides users who type the Konami code → persistent unlock).
const SUPER_ADMIN_EMAIL = "mansijmandal1999@gmail.com";
const UNLOCK_KEY = "dv_super_unlock";

// Konami code — classic sequence ↑↑↓↓←→←→BA
const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "KeyB", "KeyA",
];

export default function Landing() {
  const navigate = useNavigate();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [superUnlocked, setSuperUnlocked] = useState(false);
  const [konamiFlash, setKonamiFlash] = useState(false);

  // On mount, evaluate whether super-admin link should be visible.
  useEffect(() => {
    const u = getUser();
    if (u && getToken()) {
      // auto-redirect logged-in users to their dashboard
      if (u.role === "admin") navigate("/admin", { replace: true });
      else if (u.role === "client") navigate("/client", { replace: true });
    }
    // Super admin unlock logic
    const emailMatch = u?.email?.toLowerCase?.() === SUPER_ADMIN_EMAIL;
    const stored = typeof window !== "undefined" && localStorage.getItem(UNLOCK_KEY) === "1";
    setSuperUnlocked(emailMatch || stored);
  }, [navigate]);

  // Konami-code key sequence detector
  useEffect(() => {
    let buf: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      buf.push(e.code);
      if (buf.length > KONAMI.length) buf = buf.slice(-KONAMI.length);
      if (buf.length === KONAMI.length && buf.every((k, i) => k === KONAMI[i])) {
        localStorage.setItem(UNLOCK_KEY, "1");
        setSuperUnlocked(true);
        setKonamiFlash(true);
        setTimeout(() => setKonamiFlash(false), 2600);
        buf = [];
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="dv-landing-light">
      {/* ─────── HEADER (brand + conditional Super Admin link) ─────── */}
      <header className="dv-nav">
        <div className="dv-nav-inner">
          <Link to="/" className="dv-brand">
            <img src="/api/web/logo.svg" alt="" className="dv-brand-mark" width={44} height={44} decoding="async" />
            <img src="/api/web/wordmark.png" alt="DocVault" className="dv-brand-wordmark" />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {superUnlocked && (
              <Link to="/superadmin/login" className="dv-nav-superadmin-img" aria-label="Super Admin Login">
                <img src="/api/web/super-admin-btn.svg" alt="SUPER ADMIN" />
              </Link>
            )}
            {/* Mobile-only "Download mobile app" hyperlink — desktop hides via CSS */}
            <a
              href={APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="dv-nav-watch-mobile"
              aria-label="Download mobile app"
              download
            >
              <img src="/api/web/apk-icon.png" alt="" />
              <span>Download mobile app</span>
            </a>
          </div>
        </div>
      </header>

      {/* Konami toast flash */}
      {konamiFlash && (
        <div className="dv-konami-toast">
          🎮 Konami code accepted — Super Admin unlocked!
        </div>
      )}

      {/* ─────── HERO — 3 columns: logo (L) + headline (M) + role cards (R) ─────── */}
      <section className="dv-hero-simple" id="hero">
        <div className="dv-hero-simple-left">
          <img src="/api/web/logo.svg" alt="" className="dv-hero-logo-card" width={340} height={340} decoding="async" />
          <p className="dv-hero-sub">
            DocVault helps teams and professionals securely store, organise and share PDFs
            with complete control and peace of mind.
          </p>
          <a href={APK_URL} target="_blank" rel="noopener noreferrer" className="dv-apk-inline" download>
            <img src="/api/web/apk-icon.png" alt="" className="dv-apk-inline-icon" />
            <span>Download Android App (.apk)</span>
          </a>
        </div>

        <div className="dv-hero-headline-mid">
          <h1 className="dv-headline-static">
            <span>Organised PDF storage.</span>
            <span>Per-client privacy.</span>
            <span className="dv-grad-text">Real-time sync.</span>
          </h1>
          <span className="dv-pill dv-pill-under-head">
            Secure. Organised. Always Accessible.
          </span>
          <div className="dv-feature-pills">
            <span className="dv-nav-pill dv-pill-yellow">
              <span className="dv-np-ic">⚡</span> Auto-categorise
            </span>
            <span className="dv-nav-pill dv-pill-blue">
              <span className="dv-np-ic">🔗</span> One-tap share
            </span>
            <span className="dv-nav-pill dv-pill-red">
              <span className="dv-np-ic">🔴</span> Real-time sync
            </span>
            <span className="dv-nav-pill dv-pill-purple">
              <span className="dv-np-ic">🔒</span> Per-client privacy
            </span>
          </div>
        </div>

        {/* Mobile-only: full-width feature pills row + centered sub text — sits between
            the logo+headline row and the role cards. Hidden on desktop via CSS. */}
        <div className="dv-feature-pills-mobile">
          <span className="dv-nav-pill dv-pill-yellow">
            <span className="dv-np-ic">⚡</span> Auto-categorise
          </span>
          <span className="dv-nav-pill dv-pill-blue">
            <span className="dv-np-ic">🔗</span> One-tap share
          </span>
          <span className="dv-nav-pill dv-pill-red">
            <span className="dv-np-ic">🔴</span> Real-time sync
          </span>
          <span className="dv-nav-pill dv-pill-purple">
            <span className="dv-np-ic">🔒</span> Per-client privacy
          </span>
        </div>
        <p className="dv-hero-sub-mobile">
          DocVault helps teams and professionals securely store, organise and share PDFs
          with complete control and peace of mind.
        </p>

        <div className="dv-hero-simple-right">
          <div className="dv-role-grid-lg">
            {/* Client card */}
            <div className="dv-role-card-lg dv-role-client">
              <div className="dv-role-card-head">
                <span className="dv-role-ic-lg">👤</span>
                <div>
                  <strong>I'm a Client</strong>
                  <small>Access documents shared with you</small>
                </div>
              </div>
              <div className="dv-role-card-btns">
                <Link to="/client/login" className="dv-gradient-btn dv-full">
                  Login
                </Link>
                <Link to="/client/register" className="dv-outline-btn dv-full">
                  Register
                </Link>
              </div>
            </div>
            {/* Admin card */}
            <div className="dv-role-card-lg dv-role-admin-lg">
              <div className="dv-role-card-head">
                <span className="dv-role-ic-lg dv-role-ic-admin">🛡️</span>
                <div>
                  <strong>I'm an Admin</strong>
                  <small>Manage clients &amp; documents</small>
                </div>
              </div>
              <div className="dv-role-card-btns">
                <Link to="/admin/login" className="dv-gradient-btn dv-full">
                  Login
                </Link>
                <Link to="/admin/register" className="dv-outline-btn dv-full">
                  Register
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────── FOOTER (simplified) ─────── */}
      <footer className="dv-footer-simple">
        <div className="dv-footer-simple-inner">
          <span>© 2026 DocVault. All rights reserved.</span>
          <span className="muted">Organised PDF storage · Per-client privacy · Real-time sync</span>
        </div>
      </footer>

      {/* ─────── ROLE SELECTOR MODAL (unused in current nav but kept for later) ─────── */}
      {showRoleModal && (
        <div className="dv-modal-back" onClick={() => setShowRoleModal(false)}>
          <div className="dv-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dv-modal-close" onClick={() => setShowRoleModal(false)}>
              ✕
            </button>
            <h3>Sign in to DocVault</h3>
            <p className="muted">Choose your account type to continue</p>
            <div className="dv-role-grid">
              <Link to="/client/login" className="dv-role-card" onClick={() => setShowRoleModal(false)}>
                <span className="dv-role-ic">👤</span>
                <div>
                  <strong>I'm a Client</strong>
                  <small>Access documents shared with you</small>
                </div>
              </Link>
              <Link to="/admin/login" className="dv-role-card" onClick={() => setShowRoleModal(false)}>
                <span className="dv-role-ic">🛡️</span>
                <div>
                  <strong>I'm an Admin</strong>
                  <small>Manage clients &amp; documents</small>
                </div>
              </Link>
              {superUnlocked && (
                <Link
                  to="/superadmin/login"
                  className="dv-role-card dv-role-admin"
                  onClick={() => setShowRoleModal(false)}
                >
                  <span className="dv-role-ic">👑</span>
                  <div>
                    <strong>Super Admin</strong>
                    <small>System overview &amp; monitoring</small>
                  </div>
                </Link>
              )}
            </div>
            <div className="dv-modal-foot muted">
              New to DocVault?{" "}
              <Link to="/client/register" onClick={() => setShowRoleModal(false)}>
                Create account
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
