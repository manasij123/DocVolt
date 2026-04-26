import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, getUser } from "../api";

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const u = getUser();
    if (u && getToken()) {
      navigate(u.role === "admin" ? "/admin" : "/client", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="landing">
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
        </div>

        <div className="choose-stack">
          <span className="choose-label">Continue as</span>

          <Link to="/client/login" className="choose-card choose-client">
            <div className="choose-icon">👥</div>
            <div className="choose-text">
              <h4>Client — Login</h4>
              <p>Browse documents shared with you</p>
            </div>
            <span className="choose-arrow">→</span>
          </Link>

          <Link to="/client/register" className="choose-card choose-client-alt">
            <div className="choose-icon">✨</div>
            <div className="choose-text">
              <h4>Client — Register</h4>
              <p>Create a new client account in 30 seconds</p>
            </div>
            <span className="choose-arrow">→</span>
          </Link>

          <Link to="/admin/login" className="choose-card choose-admin">
            <div className="choose-icon">🛡️</div>
            <div className="choose-text">
              <h4>Admin</h4>
              <p>Upload & manage documents per client</p>
            </div>
            <span className="choose-arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
