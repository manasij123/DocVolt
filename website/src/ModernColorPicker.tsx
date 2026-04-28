import { useState } from "react";
import { HexColorPicker } from "react-colorful";

/* Modern color picker — combines:
 *   - native swatch grid (preset palette)
 *   - HexColorPicker (HSV square + hue slider) from react-colorful
 *   - hex input + native eyedropper (browsers that support it)
 *   - "✨ Auto-suggested" hint when the color was auto-derived from the AI prompt
 *
 * After-effects:
 *   - swatch press scales 0.92 → 1 (CSS transition)
 *   - selected swatch glows with a colored ring matched to its hue
 *   - smooth fade-in for the picker panel
 */

export type ModernColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  presets: string[];
  /** Show a small "auto-suggested" pill when true (we set this from outside
   * after running suggestColorFromText on the AI prompt). */
  autoSuggested?: boolean;
  /** Called when admin manually interacts with picker — caller uses this to
   * disable future auto-overrides. */
  onUserPick?: () => void;
};

export default function ModernColorPicker({ value, onChange, presets, autoSuggested, onUserPick }: ModernColorPickerProps) {
  const [open, setOpen] = useState(false);

  const safe = /^#[0-9A-F]{6}$/i.test(value) ? value : "#3B82F6";

  const setColor = (hex: string) => {
    onChange(hex);
    onUserPick?.();
  };

  const tryEyedropper = async () => {
    // @ts-expect-error – EyeDropper is Chromium-only and not yet in lib.dom typings.
    if (typeof window === "undefined" || typeof window.EyeDropper === "undefined") return;
    try {
      // @ts-expect-error – see above.
      const ed = new window.EyeDropper();
      const r = await ed.open();
      if (r?.sRGBHex) setColor(r.sRGBHex.toUpperCase());
    } catch { /* user cancelled */ }
  };

  return (
    <div className="mc-pick" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Top row: live preview + hex + auto-suggested hint */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          aria-label="Selected color"
          style={{
            width: 56, height: 56, borderRadius: 14, background: safe,
            boxShadow: `0 8px 22px ${safe}55, inset 0 0 0 2px rgba(255,255,255,0.7)`,
            transition: "all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 180 }}>
          <input
            value={value}
            onChange={(e) => {
              let t = e.target.value.trim();
              if (t && !t.startsWith("#")) t = "#" + t;
              setColor(t.slice(0, 9).toUpperCase());
            }}
            placeholder="#3B82F6"
            maxLength={9}
            className="input"
            style={{
              fontFamily: "ui-monospace, Menlo, monospace",
              fontWeight: 800, fontSize: 16, letterSpacing: 1.5,
              textTransform: "uppercase", textAlign: "center",
            }}
          />
          {autoSuggested && (
            <div style={{
              marginTop: 6, fontSize: 11, fontWeight: 700,
              color: "#7C3AED", display: "flex", alignItems: "center", gap: 4,
              opacity: 0.95,
            }}>
              <span style={{ fontSize: 12 }}>✨</span> Auto-suggested from your AI prompt
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="btn btn-sm"
          style={{
            background: open ? "#0F172A" : "#F8FAFC", color: open ? "#fff" : "#0F172A",
            borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 12,
            border: "1px solid #E5E7EB",
            transition: "all 180ms ease",
          }}
        >
          {open ? "▲ Close" : "🎨 Custom"}
        </button>
        {typeof window !== "undefined" &&
          // @ts-expect-error EyeDropper not in dom types
          typeof window.EyeDropper !== "undefined" && (
          <button
            type="button"
            onClick={tryEyedropper}
            className="btn btn-sm"
            title="Pick a color from anywhere on screen"
            style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 12px", fontSize: 14, border: "1px solid #E5E7EB" }}
          >🩹</button>
        )}
      </div>

      {/* Preset swatches — animated grid */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {presets.map((p) => {
          const active = value.toUpperCase() === p.toUpperCase();
          return (
            <button
              key={p}
              type="button"
              onClick={() => setColor(p)}
              aria-label={p}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: p,
                border: active ? `3px solid #0F172A` : `2px solid ${p}55`,
                cursor: "pointer", padding: 0,
                transform: active ? "scale(1.12)" : "scale(1)",
                boxShadow: active ? `0 0 0 4px ${p}33, 0 8px 18px ${p}55` : `0 2px 8px ${p}33`,
                transition: "transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {active && <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Custom HSV picker (collapsible) */}
      {open && (
        <div
          style={{
            background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 14,
            padding: 14, animation: "mcFadeIn 220ms ease",
          }}
        >
          <style>{`
            @keyframes mcFadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .mc-pick .react-colorful { width: 100% !important; height: 200px !important; }
            .mc-pick .react-colorful__saturation { border-radius: 12px !important; }
            .mc-pick .react-colorful__hue,
            .mc-pick .react-colorful__alpha { height: 16px !important; border-radius: 999px !important; margin-top: 12px !important; }
            .mc-pick .react-colorful__pointer {
              width: 22px !important; height: 22px !important;
              border: 3px solid #fff !important;
              box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important;
            }
          `}</style>
          <HexColorPicker color={safe} onChange={(c) => setColor(c.toUpperCase())} />
        </div>
      )}
    </div>
  );
}
