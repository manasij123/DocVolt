import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing } from "react-native";

const SLOGAN = "Organised PDF storage. Per-client privacy. Real-time sync.";
const TYPE_SPEED = 55;
const PAUSE_AFTER_DONE = 2400;
const ERASE_SPEED = 28;
const PAUSE_BEFORE_RETYPE = 700;

// Solid mono color for the typing slogan. On the lighter sky-blue mobile hero
// gradient, sky-blue text blends in — so we use crisp white with a soft cyan
// glow for readability + brand vibe.
const BRAND = "#FFFFFF";
const GLOW = "rgba(125,211,252,0.55)"; // sky-300 glow ring

interface Props {
  fontSize?: number;
  width?: number;
  align?: "left" | "center";
}

export default function TypingSloganMobile({ fontSize = 14, width, align = "left" }: Props) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pausing" | "erasing">("typing");
  const idxRef = useRef(0);
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cursorOpacity]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (idxRef.current < SLOGAN.length) {
        timer = setTimeout(() => {
          idxRef.current += 1;
          setText(SLOGAN.slice(0, idxRef.current));
        }, TYPE_SPEED);
      } else {
        timer = setTimeout(() => setPhase("pausing"), PAUSE_AFTER_DONE);
      }
    } else if (phase === "pausing") {
      timer = setTimeout(() => setPhase("erasing"), 100);
    } else if (phase === "erasing") {
      if (idxRef.current > 0) {
        timer = setTimeout(() => {
          idxRef.current -= 1;
          setText(SLOGAN.slice(0, idxRef.current));
        }, ERASE_SPEED);
      } else {
        timer = setTimeout(() => setPhase("typing"), PAUSE_BEFORE_RETYPE);
      }
    }
    return () => clearTimeout(timer);
  }, [text, phase]);

  return (
    <View
      style={{
        width,
        alignSelf: align === "center" ? "center" : "flex-start",
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: align === "center" ? "center" : "flex-start",
        flexWrap: "wrap",
        minHeight: fontSize * 1.5,
      }}
    >
      <Text
        style={{
          fontSize,
          fontWeight: "800",
          letterSpacing: 0.2,
          lineHeight: fontSize * 1.4,
          color: BRAND,
          textAlign: align,
          textShadow: undefined,
          // RN doesn't support textShadow shorthand; use individual props
          textShadowColor: GLOW,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
        }}
      >
        {text}
      </Text>
      <Animated.View
        style={{
          width: 2,
          height: fontSize * 1.05,
          marginLeft: 3,
          marginBottom: 2,
          backgroundColor: BRAND,
          opacity: cursorOpacity,
        }}
      />
    </View>
  );
}
