import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, getUser } from "../api";
import TypingSlogan from "../TypingSlogan";

const APK_URL =
  (import.meta.env.VITE_APK_URL as string | undefined) ||
  "https://expo.dev/artifacts/eas/e6jGMGCfQQ1arLMmiJHdaq.apk";

export default function Landing() {
  const navigate = useNavigate();
  const [showRoleModal, setShowRoleModal] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (u && getToken()) {
      if (u.role === "admin") navigate("/admin", { replace: true });
      else if (u.role === "client") navigate("/client", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="dv-landing-light">
      {/* ─────── HEADER (simplified — brand + login/get started only) ─────── */}
      <header className="dv-nav">
        <div className="dv-nav-inner">
          <Link to="/" className="dv-brand">
            <img src="/api/web/logo.png" alt="" className="dv-brand-mark" />
            <img src="/api/web/wordmark.png" alt="DocVault" className="dv-brand-wordmark" />
          </Link>
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

      {/* ─────── HERO — logo card + typing slogan + role cards ─────── */}
      <section className="dv-hero-simple">
        <div className="dv-hero-simple-left">
          <span className="dv-pill">Secure. Organised. Always Accessible.</span>
          <img src="/api/web/logo.png" alt="" className="dv-hero-logo-card" />
          <div className="dv-headline-wrap">
            <TypingSlogan size={40} />
          </div>
          <p className="dv-hero-sub">
            DocVault helps teams and professionals securely store, organise and share PDFs
            with complete control and peace of mind.
          </p>
          <a href={APK_URL} target="_blank" rel="noopener noreferrer" className="dv-apk-inline">
            📱 Download Android App (.apk)
          </a>
        </div>

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
          <div className="dv-superadmin-hint">
            System monitoring?{" "}
            <Link to="/superadmin/login">Super Admin Login →</Link>
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

      {/* ─────── ROLE SELECTOR MODAL (Login click) ─────── */}
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
