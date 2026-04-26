import { useEffect, useState } from "react";
import api, { UserInfo, initials, colorFromString } from "./api";

/**
 * ConnectModal — shared 'Connect with peer' UI.
 * The current logged-in user looks up the peer by email and forms a connection.
 * Pass `peerRole` = 'admin' (you're a client) or 'client' (you're an admin).
 */
export default function ConnectModal({
  peerRole,
  onClose,
  onConnected,
}: {
  peerRole: "admin" | "client";
  onClose: () => void;
  onConnected: (peer: UserInfo) => void;
}) {
  const [email, setEmail] = useState("");
  const [peer, setPeer] = useState<UserInfo | null>(null);
  const [looking, setLooking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setPeer(null); setErr(null); setSuccess(false);
    if (!email.trim() || !email.includes("@")) return;
    const t = setTimeout(async () => {
      setLooking(true);
      try {
        const r = await api.get("/users/lookup", { params: { email: email.trim(), role: peerRole } });
        setPeer(r.data);
      } catch (e: any) {
        setPeer(null);
        setErr(e?.response?.data?.detail || "Not found");
      } finally { setLooking(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [email, peerRole]);

  const connect = async () => {
    if (!peer) return;
    setConnecting(true); setErr(null);
    try {
      await api.post("/connections", { peer_email: peer.email });
      setSuccess(true);
      setTimeout(() => onConnected(peer), 700);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to connect");
    } finally { setConnecting(false); }
  };

  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <h3>Connect with {peerRole === "admin" ? "an admin" : "a client"}</h3>
        <p className="muted" style={{ marginTop: -6, marginBottom: 18, fontSize: 13 }}>
          {peerRole === "admin"
            ? "Enter the email your admin gave you. You can connect with multiple admins."
            : "Enter the client's email. They must have registered first."}
        </p>
        <div className="field">
          <label>{peerRole === "admin" ? "Admin email" : "Client email"}</label>
          <div className="input-with-icon">
            <span className="field-prefix">✉️</span>
            <input
              className="input"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={peerRole === "admin" ? "admin@org.com" : "client@example.com"}
            />
          </div>
        </div>

        {looking && <div className="muted" style={{ fontSize: 13 }}>⏳ Looking up…</div>}

        {peer && !success && (
          <div className="peer-preview">
            <div className="avatar" style={{ background: colorFromString(peer.id) }}>{initials(peer.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{peer.name}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{peer.role === "admin" ? "Admin · " : "Client · "}{peer.email}</div>
            </div>
            <span className="badge year">{peer.role.toUpperCase()}</span>
          </div>
        )}

        {success && (
          <div className="banner success">✓ Connected with {peer?.name}!</div>
        )}

        {err && !looking && <div className="banner error" style={{ marginTop: 12 }}>⚠ {err}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!peer || connecting || success} onClick={connect}>
            {connecting ? "Connecting…" : success ? "Connected" : "🔗 Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
