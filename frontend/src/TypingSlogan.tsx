import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing } from "react-native";

const SLOGAN = "Organised PDF storage. Per-client privacy. Real-time sync.";
const TYPE_SPEED = 55;
const PAUSE_AFTER_DONE = 2400;
const ERASE_SPEED = 28;
const PAUSE_BEFORE_RETYPE = 700;

// Solid brand mono color — DocVault sky-blue (matches theme #1A73E8 family,
// lifted to #38BDF8 for max readability on the dark navy hero background).
const BRAND = "#38BDF8";

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
          textShadowColor: "rgba(56,189,248,0.45)",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
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
