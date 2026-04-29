import { useEffect, useState, useRef } from "react";

const SLOGAN_TEXT = "Organised PDF storage. Per-client privacy. Real-time sync.";
const TYPE_SPEED_MS = 55;
const PAUSE_AFTER_DONE = 2400;
const ERASE_SPEED_MS = 28;
const PAUSE_BEFORE_RETYPE = 700;

// Solid brand mono color — DocVault sky-blue (matches theme-color #1A73E8 family)
// Slightly lifted to #38BDF8 for max readability on the dark navy hero background.
const BRAND = "#38BDF8";

export default function TypingSlogan({ size = 18 }: { size?: number }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pausing" | "erasing">("typing");
  const idxRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (idxRef.current < SLOGAN_TEXT.length) {
        timer = setTimeout(() => {
          idxRef.current += 1;
          setText(SLOGAN_TEXT.slice(0, idxRef.current));
        }, TYPE_SPEED_MS);
      } else {
        timer = setTimeout(() => setPhase("pausing"), PAUSE_AFTER_DONE);
      }
    } else if (phase === "pausing") {
      timer = setTimeout(() => setPhase("erasing"), 100);
    } else if (phase === "erasing") {
      if (idxRef.current > 0) {
        timer = setTimeout(() => {
          idxRef.current -= 1;
          setText(SLOGAN_TEXT.slice(0, idxRef.current));
        }, ERASE_SPEED_MS);
      } else {
        timer = setTimeout(() => setPhase("typing"), PAUSE_BEFORE_RETYPE);
      }
    }
    return () => clearTimeout(timer);
  }, [text, phase]);

  return (
    <span
      className="dv-slogan-typing"
      style={{
        display: "inline-block",
        fontSize: size,
        fontWeight: 800,
        letterSpacing: 0.25,
        lineHeight: 1.4,
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, 'Inter', sans-serif",
        minHeight: size * 1.55,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: BRAND,
        textShadow: `0 0 18px rgba(56,189,248,0.35)`,
      }}
    >
      <span>{text}</span>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 2,
          height: size * 1.05,
          marginLeft: 4,
          background: BRAND,
          borderRadius: 1,
          verticalAlign: "text-bottom",
          animation: "dv-cursor-blink 0.85s steps(2, start) infinite",
          boxShadow: `0 0 8px ${BRAND}`,
        }}
      />
      <style>{`
        @keyframes dv-cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}
