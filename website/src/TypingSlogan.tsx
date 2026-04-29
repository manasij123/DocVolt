import { useEffect, useState, useRef } from "react";

const SLOGAN_TEXT = "Organised PDF storage. Per-client privacy. Real-time sync.";
const TYPE_SPEED_MS = 55;       // delay between characters
const PAUSE_AFTER_DONE = 2200;  // pause when fully typed
const ERASE_SPEED_MS = 30;      // delay between deletions
const PAUSE_BEFORE_RETYPE = 800;

const GRADIENT = "linear-gradient(90deg, #5900FF 0%, #FF00D0 52%, #29AD88 100%)";

export default function TypingSlogan({ size = 18 }: { size?: number }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pausing" | "erasing" | "idle">("typing");
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
        letterSpacing: 0.2,
        lineHeight: 1.35,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        minHeight: size * 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <span
        style={{
          backgroundImage: GRADIENT,
          backgroundSize: "200% 100%",
          backgroundPosition: "0% 50%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          color: "transparent",
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
          marginLeft: 3,
          background: "linear-gradient(180deg, #5900FF 0%, #FF00D0 50%, #29AD88 100%)",
          verticalAlign: "text-bottom",
          animation: "dv-cursor-blink 0.9s steps(2, start) infinite",
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
