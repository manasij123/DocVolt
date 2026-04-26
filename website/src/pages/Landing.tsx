import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getRole, getToken, setRole } from "../api";

export default function Landing() {
  const navigate = useNavigate();

  // Persistent login (WhatsApp-style): if user has a saved role, send them straight in.
  useEffect(() => {
    const role = getRole();
    if (role === "client") navigate("/client", { replace: true });
    else if (role === "admin" && getToken()) navigate("/admin", { replace: true });
  }, [navigate]);

  const goClient = () => {
    setRole("client");
    navigate("/client");
  };

  return (
    <div className="landing">
      <div className="landing-inner container">
        <div className="hero-block">
          <div className="hero-logo">DV</div>
          <h1 className="hero-title">DocVault</h1>
          <p className="hero-tagline">
            Organised PDF storage for your team — Monthly Returns,
            Forwarding Letters, IFA Reports.<br />
            <strong>Same data on web, mobile and desktop — instantly synced.</strong>
          </p>
          <div className="hero-pills">
            <span className="hero-pill">⚡ Auto-categorise</span>
            <span className="hero-pill">🔗 One-tap share</span>
            <span className="hero-pill">🔴 Real-time sync</span>
          </div>
        </div>

        <div className="choose-stack">
          <span className="choose-label">Continue as</span>

          <button className="choose-card choose-client" onClick={goClient}>
            <div className="choose-icon">👥</div>
            <div className="choose-text">
              <h4>Client</h4>
              <p>Browse and share documents</p>
            </div>
            <span className="choose-arrow">→</span>
          </button>

          <Link to="/admin/login" className="choose-card choose-admin">
            <div className="choose-icon">🛡️</div>
            <div className="choose-text">
              <h4>Admin</h4>
              <p>Upload & manage documents</p>
            </div>
            <span className="choose-arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
