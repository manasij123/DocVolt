import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setToken, setUser } from "../api";

export default function ClientRegister() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setErr("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        name: name.trim(), email: email.trim(), password, role: "client",
      });
      setToken(res.data.access_token);
      setUser(res.data.user);
      nav("/client");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link to="/" style={{ color: "#fff", display: "inline-block", marginBottom: 18, opacity: 0.85, fontSize: 14, fontWeight: 600 }}>← Back</Link>
        <div className="login-icon">✨</div>
        <h2 className="login-title">Create your account</h2>
        <p className="login-sub">Free — takes 30 seconds. Admins are notified instantly.</p>
        <div className="card card-md">
          {err && <div className="banner error">⚠ {err}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Full name</label>
              <div className="input-with-icon">
                <span className="field-prefix">👤</span>
                <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
              </div>
            </div>
            <div className="field">
              <label>Email</label>
              <div className="input-with-icon">
                <span className="field-prefix">✉️</span>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
              </div>
            </div>
            <div className="field">
              <label>Password</label>
              <div className="input-with-icon">
                <span className="field-prefix">🔒</span>
                <input className="input" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required autoComplete="new-password" />
                <button type="button" className="eye-btn" onClick={() => setShowPwd((s) => !s)}>{showPwd ? "🙈" : "👁️"}</button>
              </div>
            </div>
            <div className="field">
              <label>Confirm password</label>
              <div className="input-with-icon">
                <span className="field-prefix">✅</span>
                <input className="input" type={showPwd ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" required autoComplete="new-password" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 4 }} disabled={loading}>
              {loading ? "Creating…" : "Create account →"}
            </button>
            <div className="hint">Have an account? <Link to="/client/login" style={{ color: "#1A73E8", fontWeight: 700 }}>Sign in</Link></div>
          </form>
        </div>
      </div>
    </div>
  );
}
