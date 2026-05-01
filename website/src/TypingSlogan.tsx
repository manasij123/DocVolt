import { useEffect, useState, useRef } from "react";

// Multi-line hero headline that types itself letter-by-letter.
// The final line is rendered in a brand gradient (blue → purple).
// Size is responsive via the `size` prop (px) but content line-breaks are
// hard-coded so the layout is predictable regardless of viewport.
const LINES = [
  "Organised PDF storage.",
  "Per-client privacy.",
  "Real-time sync.", // gradient line
];
const FULL = LINES.join("\n");
const TYPE_SPEED_MS = 55;
const PAUSE_AFTER_DONE = 2800;
const ERASE_SPEED_MS = 28;
const PAUSE_BEFORE_RETYPE = 800;

export default function TypingSlogan({ size = 44 }: { size?: number }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pausing" | "erasing">("typing");
  const idxRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (idxRef.current < FULL.length) {
        timer = setTimeout(() => {
          idxRef.current += 1;
          setText(FULL.slice(0, idxRef.current));
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
          setText(FULL.slice(0, idxRef.current));
        }, ERASE_SPEED_MS);
      } else {
        timer = setTimeout(() => setPhase("typing"), PAUSE_BEFORE_RETYPE);
      }
    }
    return () => clearTimeout(timer);
  }, [text, phase]);

  // Split current typed text back into visible lines, identifying which line
  // is the "gradient line" (the last of LINES). That gives us per-line styling.
  const typedLineCount = (text.match(/\n/g) || []).length; // 0, 1, or 2
  const linesOut: string[] = text.split("\n"); // up to 3 entries
  const lastIdx = LINES.length - 1;

  return (
    <h1
      className="dv-headline-typing"
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.12,
        letterSpacing: "-1.4px",
        margin: 0,
        color: "#0F172A",
        minHeight: size * 1.12 * LINES.length, // reserve full space to avoid layout jump
      }}
    >
      {linesOut.map((lineTxt, i) => {
        const isGradient = i === lastIdx;
        const isCurrentLine = i === typedLineCount;
        return (
          <div
            key={i}
            className={isGradient ? "dv-grad-text" : ""}
            style={{
              display: "block",
              background: isGradient
                ? "linear-gradient(90deg, #3B82F6 0%, #6366F1 50%, #A855F7 100%)"
                : undefined,
              WebkitBackgroundClip: isGradient ? "text" : undefined,
              backgroundClip: isGradient ? "text" : undefined,
              WebkitTextFillColor: isGradient ? "transparent" : undefined,
              color: isGradient ? "transparent" : "#0F172A",
            }}
          >
            {lineTxt || "\u00A0" /* keep line height when empty */}
            {isCurrentLine && (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 3,
                  height: size * 0.9,
                  marginLeft: 4,
                  background: "linear-gradient(180deg, #3B82F6 0%, #A855F7 100%)",
                  borderRadius: 1.5,
                  verticalAlign: "text-bottom",
                  animation: "dv-cursor-blink 0.85s steps(2, start) infinite",
                  boxShadow: "0 0 8px rgba(99,102,241,0.5)",
                }}
              />
            )}
          </div>
        );
      })}
      <style>{`
        @keyframes dv-cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </h1>
  );
}
