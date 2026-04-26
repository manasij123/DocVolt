/**
 * SecurityBackground — global, decorative, non-interactive overlay.
 *
 * (D) "Aurora Mesh" + (A) "Encrypted Vault" — same visual concept as the
 * mobile component (`/app/frontend/src/SecurityBackground.tsx`) so both
 * platforms feel identical.
 *
 * Mounted once in `main.tsx` so it sits behind every route. `pointer-events:
 * none` guarantees zero impact on clicks/taps.
 */
import React from "react";

const PALETTE = {
  red: "#c1121f",
  cream: "#fdf0d5",
  blue: "#669bbc",
};

// Inline SVG glyphs (lock, shield, key, document, fingerprint, scan).
// Stroke-based, sized via CSS `width` / `height`.
const Glyphs: Record<string, React.ReactNode> = {
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="14" r="4" />
      <path d="M11 13l9-9M17 8l3 3M14 11l3 3" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  ),
  finger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 11v3a4 4 0 0 1-4 4" />
      <path d="M16 11v2a8 8 0 0 1-2 5" />
      <path d="M8 14a4 4 0 0 1 8 0" />
      <path d="M5 11a7 7 0 0 1 14 0" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  ),
};

type IconCfg = {
  glyph: keyof typeof Glyphs;
  left: string; top: string; size: number;
  duration: number; delay: number; color: string;
};

const ICON_CFGS: IconCfg[] = [
  { glyph: "lock",   left: "8%",  top: "20%", size: 28, duration: 14, delay: 0,  color: PALETTE.red },
  { glyph: "shield", left: "78%", top: "12%", size: 34, duration: 17, delay: 2,  color: PALETTE.blue },
  { glyph: "key",    left: "22%", top: "70%", size: 26, duration: 16, delay: 4,  color: PALETTE.cream },
  { glyph: "doc",    left: "62%", top: "55%", size: 30, duration: 18, delay: 1,  color: PALETTE.red },
  { glyph: "finger", left: "44%", top: "30%", size: 24, duration: 13, delay: 3,  color: PALETTE.blue },
  { glyph: "scan",   left: "85%", top: "78%", size: 32, duration: 19, delay: 5,  color: PALETTE.cream },
  { glyph: "lock",   left: "12%", top: "45%", size: 22, duration: 15, delay: 6,  color: PALETTE.blue },
  { glyph: "shield", left: "55%", top: "82%", size: 26, duration: 16, delay: 7,  color: PALETTE.red },
  { glyph: "key",    left: "70%", top: "35%", size: 22, duration: 14, delay: 2,  color: PALETTE.blue },
];

export default function SecurityBackground() {
  return (
    <div className="security-bg" aria-hidden>
      {/* Aurora blobs */}
      <span className="sec-blob sec-blob-red" />
      <span className="sec-blob sec-blob-blue" />
      <span className="sec-blob sec-blob-cream" />
      {/* Floating vault icons */}
      {ICON_CFGS.map((c, i) => (
        <span
          key={`ic-${i}`}
          className="sec-icon"
          style={{
            left: c.left,
            top: c.top,
            width: c.size,
            height: c.size,
            color: c.color,
            animationDuration: `${c.duration}s, ${c.duration * 0.45}s`,
            animationDelay: `${c.delay}s, ${c.delay * 0.7}s`,
          }}
        >
          {Glyphs[c.glyph]}
        </span>
      ))}
    </div>
  );
}
