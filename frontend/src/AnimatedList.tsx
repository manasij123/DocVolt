/**
 * AnimatedList — small utilities that wrap children in Reanimated `entering`
 * animations for consistent list/card stagger across all mobile screens.
 *
 *   <FadeInItem index={i}>{...}</FadeInItem>
 *
 * Internally uses `react-native-reanimated`'s declarative `entering` prop with
 * `FadeInDown` + a per-index delay, so first item slides in instantly and
 * subsequent ones cascade nicely.
 *
 * For modal / dialog / sheet enter animations use `<ModalEnter>`.
 */
import React from "react";
import Animated, { FadeInDown, FadeIn, ZoomIn } from "react-native-reanimated";

type FadeInItemProps = {
  index?: number;
  baseDelay?: number;
  step?: number;
  duration?: number;
  children: React.ReactNode;
  style?: any;
};

export function FadeInItem({
  index = 0,
  baseDelay = 0,
  step = 55,
  duration = 380,
  children,
  style,
}: FadeInItemProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(baseDelay + index * step).duration(duration).springify().damping(16)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export function ModalEnter({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <Animated.View
      entering={ZoomIn.duration(280).springify().damping(14)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export function ScreenFadeIn({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <Animated.View entering={FadeIn.duration(280)} style={style}>
      {children}
    </Animated.View>
  );
}

export default FadeInItem;
