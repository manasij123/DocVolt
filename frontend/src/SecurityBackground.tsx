/**
 * SecurityBackground — global, decorative, non-interactive overlay.
 *
 * Combines two effects:
 *  (D) "Aurora Mesh" — three big, soft, slowly drifting colour-blobs.
 *  (A) "Encrypted Vault" — small security-themed icons (lock, shield, key,
 *      fingerprint, document, scan) gently floating upward with fade-in/out.
 *
 * Palette: #c1121f (deep red) · #fdf0d5 (cream) · #669bbc (muted blue).
 *
 * Mounted once at the root of the navigation stack (see app/_layout.tsx) so it
 * sits behind every screen. pointerEvents="none" guarantees zero impact on
 * touch handling, and overall opacity is intentionally low so it never
 * competes with foreground content.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PALETTE = {
  red: "#c1121f",
  cream: "#fdf0d5",
  blue: "#669bbc",
};

const ICON_NAMES: Array<keyof typeof Ionicons.glyphMap> = [
  "lock-closed",
  "shield-checkmark",
  "key",
  "document-text",
  "finger-print",
  "scan",
  "lock-closed",
  "shield-checkmark",
  "key",
];

type Blob = { color: string; size: number; left: number; top: number; delay: number; duration: number };
type FloatIcon = {
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  left: number;
  startTop: number;
  driftDuration: number;
  fadeDelay: number;
  color: string;
};

function pseudoRandom(seed: number) {
  // Tiny deterministic PRNG so the layout is stable across renders.
  let s = seed * 9301 + 49297;
  s = (s % 233280) / 233280;
  return s;
}

export default function SecurityBackground() {
  const { width, height } = Dimensions.get("window");

  const blobs: Blob[] = useMemo(
    () => [
      { color: PALETTE.red, size: Math.max(width, 360) * 0.95, left: -width * 0.25, top: -height * 0.05, delay: 0, duration: 16000 },
      { color: PALETTE.blue, size: Math.max(width, 360) * 1.05, left: width * 0.35, top: height * 0.30, delay: 2200, duration: 19000 },
      { color: PALETTE.cream, size: Math.max(width, 360) * 0.90, left: -width * 0.10, top: height * 0.55, delay: 4500, duration: 22000 },
    ],
    [width, height],
  );

  const icons: FloatIcon[] = useMemo(() => {
    const total = 9;
    const list: FloatIcon[] = [];
    for (let i = 0; i < total; i++) {
      const r1 = pseudoRandom(i + 1);
      const r2 = pseudoRandom(i * 3 + 7);
      const r3 = pseudoRandom(i * 5 + 13);
      const palette = [PALETTE.red, PALETTE.blue, PALETTE.cream];
      list.push({
        name: ICON_NAMES[i % ICON_NAMES.length],
        size: 18 + Math.floor(r1 * 18), // 18–36
        left: r2 * (width - 40),
        startTop: r3 * height,
        driftDuration: 9000 + Math.floor(r1 * 9000), // 9–18s
        fadeDelay: Math.floor(r2 * 6000),
        color: palette[i % palette.length],
      });
    }
    return list;
  }, [width, height]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.tint} />
      {blobs.map((b, i) => (
        <DriftingBlob key={`blob-${i}`} {...b} />
      ))}
      {icons.map((it, i) => (
        <FloatingIcon key={`ic-${i}`} {...it} containerHeight={height} />
      ))}
    </View>
  );
}

function DriftingBlob({ color, size, left, top, delay, duration }: Blob) {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopDrift = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const loopPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: duration * 0.6, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: duration * 0.6, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => {
      loopDrift.start();
      loopPulse.start();
    }, delay);
    return () => {
      clearTimeout(t);
      loopDrift.stop();
      loopPulse.stop();
    };
  }, [drift, pulse, duration, delay]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [20, -25] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  return (
    <Animated.View
      style={[
        styles.blob,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left,
          top,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    />
  );
}

function FloatingIcon({
  name, size, left, startTop, driftDuration, fadeDelay, color, containerHeight,
}: FloatIcon & { containerHeight: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopTranslate = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: 1, duration: driftDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: driftDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const loopFade = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => {
      loopTranslate.start();
      loopFade.start();
    }, fadeDelay);
    return () => {
      clearTimeout(t);
      loopTranslate.stop();
      loopFade.stop();
    };
  }, [translateY, opacity, driftDuration, fadeDelay]);

  const ty = translateY.interpolate({
    inputRange: [0, 1],
    // Drift slowly upward by ~20% of viewport height.
    outputRange: [0, -containerHeight * 0.20],
  });
  const finalOpacity = opacity.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.16] });

  return (
    <Animated.View
      style={[
        styles.icon,
        { left, top: startTop, transform: [{ translateY: ty }], opacity: finalOpacity },
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  blob: {
    position: "absolute",
    opacity: 0.12,
  },
  icon: {
    position: "absolute",
  },
});
