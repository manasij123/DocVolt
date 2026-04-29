import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

const SLOGAN = "Organised PDF storage. Per-client privacy. Real-time sync.";
const TYPE_SPEED = 55;
const PAUSE_AFTER_DONE = 2200;
const ERASE_SPEED = 30;
const PAUSE_BEFORE_RETYPE = 800;

interface Props {
  fontSize?: number;
  width?: number;
  align?: "left" | "center";
}

export default function TypingSloganMobile({ fontSize = 14, width, align = "left" }: Props) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pausing" | "erasing">("typing");
  const idxRef = useRef(0);

  // blinking cursor
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
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

  // The text element used as both mask and visible (via gradient overlay)
  const renderText = (color: string) => (
    <Text
      style={{
        fontSize,
        fontWeight: "800",
        letterSpacing: 0.2,
        lineHeight: fontSize * 1.4,
        color,
        textAlign: align,
        fontFamily: undefined,
      }}
    >
      {text || " "}
    </Text>
  );

  return (
    <View
      style={{
        width,
        alignSelf: align === "center" ? "center" : "flex-start",
        flexDirection: "row",
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <MaskedView style={{ flexShrink: 1 }} maskElement={renderText("#000")}>
        <LinearGradient
          colors={["#5900FF", "#FF00D0", "#29AD88"]}
          locations={[0, 0.52, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        >
          {/* invisible text gives the gradient layer the right size */}
          {renderText("transparent")}
        </LinearGradient>
      </MaskedView>
      <Animated.View
        style={{
          width: 2,
          height: fontSize * 1.05,
          marginLeft: 3,
          marginBottom: 2,
          backgroundColor: "#FF00D0",
          opacity: cursorOpacity,
        }}
      />
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _styles = StyleSheet.create({});
