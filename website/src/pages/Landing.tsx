import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, getUser } from "../api";
import SecurityBackground from "../SecurityBackground";

const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)
  || "https://expo.dev/artifacts/eas/e6jGMGCfQQ1arLMmiJHdaq.apk";

export default function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    const u = getUser();
    if (u && getToken()) navigate(u.role === "admin" ? "/admin" : "/client", { replace: true });
  }, [navigate]);

  return (
    <div className="landing">
      <SecurityBackground />
      <div className="landing-inner container">
        <div className="hero-block">
          <div className="hero-logo">DV</div>
          <h1 className="hero-title">DocVault</h1>
          <p className="hero-tagline">
            Organised PDF storage for your team — Monthly Returns,
            Forwarding Letters, IFA Reports.<br />
            <strong>Per-client privacy. Real-time sync. Same data on web & mobile.</strong>
          </p>
          <div className="hero-pills">
            <span className="hero-pill">⚡ Auto-categorise</span>
            <span className="hero-pill">🔗 One-tap share</span>
            <span className="hero-pill">🔴 Real-time sync</span>
            <span className="hero-pill">🔒 Per-client privacy</span>
          </div>

          <a
            href={APK_URL}
            target="_blank"
            rel="noreferrer"
            className="apk-cta"
            aria-label="Download Android APK"
          >
            <span className="apk-cta-icon" aria-hidden>📱</span>
            <span className="apk-cta-body">
              <span className="apk-cta-title">Download Android App (.apk)</span>
              <span className="apk-cta-sub">Install DocVault on your phone — same data, real-time sync</span>
            </span>
            <span className="apk-cta-chev" aria-hidden>↓</span>
          </a>
        </div>

        <div className="choose-stack">
          <span className="choose-label">I'm a Client</span>

          <Link to="/client/login" className="choose-card choose-client">
            <div className="choose-icon">👥</div>
            <div className="choose-text"><h4>Client — Login</h4><p>Browse documents shared with you</p></div>
            <span className="choose-arrow">→</span>
          </Link>

          <Link to="/client/register" className="choose-card choose-client-alt">
            <div className="choose-icon">✨</div>
            <div className="choose-text"><h4>Client — Register</h4><p>Create an account & connect with your admin</p></div>
            <span className="choose-arrow">→</span>
          </Link>

          <span className="choose-label" style={{ marginTop: 14 }}>I'm an Admin</span>

          <Link to="/admin/login" className="choose-card choose-admin">
            <div className="choose-icon">🛡️</div>
            <div className="choose-text"><h4>Admin — Login</h4><p>Manage your clients & documents</p></div>
            <span className="choose-arrow">→</span>
          </Link>

          <Link to="/admin/register" className="choose-card choose-admin-alt">
            <div className="choose-icon">🚀</div>
            <div className="choose-text"><h4>Admin — Register</h4><p>Set up your own admin workspace</p></div>
            <span className="choose-arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
