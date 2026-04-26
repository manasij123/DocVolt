import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setToken, setUser } from "../api";
import AuthHeroIcon from "../AuthHeroIcon";

export default function ClientLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const res = await api.post("/auth/login", { email: email.trim(), password });
      if (res.data.user.role !== "client") {
        throw new Error("This account is an admin. Use Admin login instead.");
      }
      setToken(res.data.access_token);
      setUser(res.data.user);
      nav("/client");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link to="/" style={{ color: "#fff", display: "inline-block", marginBottom: 18, opacity: 0.85, fontSize: 14, fontWeight: 600 }}>← Back</Link>
        <div className="login-icon">👥</div>
        <AuthHeroIcon mode="login" role="client" />
        <h2 className="login-title">Client Login</h2>
        <p className="login-sub">Welcome back — sign in to view your documents</p>
        <div className="card card-md">
          {err && <div className="banner error">⚠ {err}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <div className="input-with-icon">
                <span className="field-prefix">✉️</span>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="username" />
              </div>
            </div>
            <div className="field">
              <label>Password</label>
              <div className="input-with-icon">
                <span className="field-prefix">🔒</span>
                <input className="input" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" className="eye-btn" onClick={() => setShowPwd((s) => !s)}>{showPwd ? "🙈" : "👁️"}</button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 10 }} disabled={loading}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
            <div className="hint">No account? <Link to="/client/register" style={{ color: "#1A73E8", fontWeight: 700 }}>Register</Link></div>
          </form>
        </div>
      </div>
    </div>
  );
}
