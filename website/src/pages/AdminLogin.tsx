import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { setRole, setToken } from "../api";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await api.post("/auth/login", { email: email.trim(), password });
      setToken(res.data.access_token);
      setRole("admin");
      nav("/admin");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link to="/" style={{ color: "#fff", display: "inline-block", marginBottom: 18, opacity: 0.85, fontSize: 14, fontWeight: 600 }}>← Back</Link>
        <div className="login-icon">🛡️</div>
        <h2 className="login-title">Welcome back</h2>
        <p className="login-sub">Sign in to manage your documents</p>

        <div className="card card-md">
          {err && <div className="banner error">{err}</div>}

          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <div className="input-with-icon">
                <span className="field-prefix">✉️</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>Password</label>
              <div className="input-with-icon">
                <span className="field-prefix">🔒</span>
                <input
                  className="input"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 10 }} disabled={loading}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>

            <div className="hint">
              ℹ️ Demo: <span className="kbd">admin@example.com</span> / <span className="kbd">admin123</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
