import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, getUser } from "../api";
import SecurityBackground from "../SecurityBackground";
import { Ic } from "../Icons";

const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)
  || "https://expo.dev/artifacts/eas/e6jGMGCfQQ1arLMmiJHdaq.apk";

export default function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    const u = getUser();
    if (u && getToken()) {
      const dest = u.role === "admin" ? "/admin"
        : u.role === "superadmin" ? "/superadmin"
        : "/client";
      navigate(dest, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="landing">
      <SecurityBackground />
      <div className="landing-inner container">
        <div className="hero-block">
          <img
            src="/api/web/docvault-logo.png"
            alt="DocVault"
            className="hero-logo"
            style={{ width: 96, height: 96, borderRadius: 22, objectFit: "cover", boxShadow: "0 16px 50px rgba(59,130,246,0.45)" }}
          />
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
            <span className="apk-cta-icon" aria-hidden>
              <img
                src="https://img.icons8.com/3d-fluency/94/android-os.png"
                alt="APK"
                style={{ display: "block" }}
              />
            </span>
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
            <div className="choose-icon"><Ic kind="login" size={32} /></div>
            <div className="choose-text"><h4>Client — Login</h4><p>Browse documents shared with you</p></div>
            <span className="choose-arrow">→</span>
          </Link>

          <Link to="/client/register" className="choose-card choose-client-alt">
            <div className="choose-icon"><Ic kind="register" size={32} /></div>
            <div className="choose-text"><h4>Client — Register</h4><p>Create an account & connect with your admin</p></div>
            <span className="choose-arrow">→</span>
          </Link>

          <span className="choose-label" style={{ marginTop: 14 }}>I'm an Admin</span>

          <Link to="/admin/login" className="choose-card choose-admin">
            <div className="choose-icon"><Ic kind="login" size={32} /></div>
            <div className="choose-text"><h4>Admin — Login</h4><p>Manage your clients & documents</p></div>
            <span className="choose-arrow">→</span>
          </Link>

          <Link to="/admin/register" className="choose-card choose-admin-alt">
            <div className="choose-icon"><Ic kind="register" size={32} /></div>
            <div className="choose-text"><h4>Admin — Register</h4><p>Set up your own admin workspace</p></div>
            <span className="choose-arrow">→</span>
          </Link>
        </div>
      </div>
      {/* Subtle System Owner entry — bookmarkable, not announced on the home page */}
      <Link to="/superadmin/login" style={{
        position: "fixed", bottom: 12, right: 16,
        fontSize: 11, color: "rgba(255,255,255,0.35)",
        textDecoration: "none", letterSpacing: 0.5,
      }} title="System Owner Console">
        · system ·
      </Link>
    </div>
  );
}
