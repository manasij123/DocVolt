/**
 * AuthHeroIcon — composite circular badge for login/register pages.
 *
 * Mirrors the mobile AuthForm hero badge: a large gradient-filled circle
 * containing a primary glyph, with a small white overlay disc at bottom-right
 * carrying a secondary glyph.
 *
 *   LOGIN  → padlock-style badge   (refs the user-supplied "user + lock" art)
 *   REG    → clipboard-with-pencil (refs the "clipboard + pencil" art)
 *
 * Each (mode, role) combination uses a distinct main icon + colour gradient so
 * the four screens feel related but visibly different.
 */
import React from "react";

type Mode = "login" | "register";
type Role = "admin" | "client";

const COMMON: React.SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const Glyph = {
  shield: (
    <svg {...COMMON}><path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
      <path d="M9 12l2 2 4-4" /></svg>
  ),
  person: (
    <svg {...COMMON}><circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>
  ),
  lock: (
    <svg {...COMMON}><rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
  ),
  clipboardSolid: (
    <svg {...COMMON}><rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 12h6M9 16h4" /></svg>
  ),
  clipboardLine: (
    <svg {...COMMON}><rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 12h6M9 16h4" /></svg>
  ),
  pencil: (
    <svg {...COMMON}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" />
      <path d="M14 5l3 3" /></svg>
  ),
};

const SPECS: Record<`${Mode}-${Role}`, {
  main: keyof typeof Glyph;
  overlay: keyof typeof Glyph;
  c1: string; c2: string;
  overlayColor: string;
}> = {
  "login-admin":     { main: "shield",         overlay: "lock",   c1: "#1E3A8A", c2: "#1E40AF", overlayColor: "#1E3A8A" },
  "login-client":    { main: "person",         overlay: "lock",   c1: "#0F4C81", c2: "#1E66A8", overlayColor: "#0F4C81" },
  "register-admin":  { main: "clipboardSolid", overlay: "shield", c1: "#F59E0B", c2: "#EF4444", overlayColor: "#EF4444" },
  "register-client": { main: "clipboardLine",  overlay: "pencil", c1: "#FB923C", c2: "#F43F5E", overlayColor: "#F43F5E" },
};

export default function AuthHeroIcon({ mode, role }: { mode: Mode; role: Role }) {
  const spec = SPECS[`${mode}-${role}`];
  return (
    <div className="auth-hero-icon" aria-hidden>
      <div
        className="ahi-disc"
        style={{ background: `linear-gradient(135deg, ${spec.c1} 0%, ${spec.c2} 100%)` }}
      >
        <span className="ahi-main" style={{ color: "#fff" }}>{Glyph[spec.main]}</span>
      </div>
      <div className="ahi-overlay" style={{ color: spec.overlayColor }}>
        {Glyph[spec.overlay]}
      </div>
    </div>
  );
}
