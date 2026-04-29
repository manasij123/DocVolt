import { useEffect, useState, useRef } from "react";

const SLOGAN_TEXT = "Organised PDF storage. Per-client privacy. Real-time sync.";
const TYPE_SPEED_MS = 55;
const PAUSE_AFTER_DONE = 2400;
const ERASE_SPEED_MS = 28;
const PAUSE_BEFORE_RETYPE = 700;

// Aurora — cool electric flowing gradient (cyan → sky → indigo → fuchsia → cyan loop)
// Picked to harmonise with the dark-blue landing background and the purple/blue brand logo.
const GRADIENT =
  "linear-gradient(90deg, #22D3EE 0%, #38BDF8 18%, #6366F1 38%, #A855F7 58%, #EC4899 78%, #22D3EE 100%)";

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
      }}
    >
      <span
        style={{
          backgroundImage: GRADIENT,
          backgroundSize: "300% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          color: "transparent",
          animation: "dv-aurora-shift 6s linear infinite",
          filter: "drop-shadow(0 1px 6px rgba(99,102,241,0.35))",
        }}
      >
        {text}
      </span>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 2,
          height: size * 1.05,
          marginLeft: 4,
          background:
            "linear-gradient(180deg, #22D3EE 0%, #A855F7 55%, #EC4899 100%)",
          borderRadius: 1,
          verticalAlign: "text-bottom",
          animation: "dv-cursor-blink 0.85s steps(2, start) infinite",
          boxShadow: "0 0 6px rgba(168,85,247,0.55)",
        }}
      />
      <style>{`
        @keyframes dv-cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes dv-aurora-shift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </span>
  );
}
