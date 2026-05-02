import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setToken, setUser } from "../api";
import { Ic } from "../Icons";

export default function SuperAdminLogin() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      // Backend `/auth/login` accepts `email` field that matches either email OR username.
      const res = await api.post("/auth/login", { email: username.trim(), password });
      if (res.data.user.role !== "superadmin") {
        throw new Error("This account does not have super-admin access.");
      }
      setToken(res.data.access_token);
      setUser(res.data.user);
      nav("/superadmin");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page" style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 50%, #3801FF14 100%)" }}>
      <div className="login-card">
        <Link to="/" style={{ color: "#0F172A", display: "inline-block", marginBottom: 18, opacity: 0.85, fontSize: 14, fontWeight: 600 }}>← Back</Link>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #3801FF, #5B2DFF)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 28px rgba(56,1,255,0.35)" }}>
            <span style={{ fontSize: 36 }}>🛡️</span>
          </div>
        </div>
        <h2 className="login-title" style={{ color: "#0F172A" }}>System Owner</h2>
        <p className="login-sub" style={{ color: "#475569" }}>Restricted access — global system overview</p>
        <div className="card card-md">
          {err && <div className="banner error">⚠ {err}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Username</label>
              <div className="input-with-icon">
                <span className="field-prefix">👤</span>
                <input
                  className="input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@dM!n#... "
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
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
                  required
                  autoComplete="current-password"
                  style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
                />
                <button type="button" className="eye-btn" onClick={() => setShowPwd((s) => !s)}>{showPwd ? "🙈" : "👁️"}</button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={loading}>
              <Ic kind="login" size={18} />
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <div className="hint" style={{ fontSize: 11, color: "#94A3B8" }}>
              ℹ️ This screen is intentionally hidden from the home page. Bookmark it.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
