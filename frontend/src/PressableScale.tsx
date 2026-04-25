import React, { useRef } from "react";
import { Pressable, PressableProps, Animated, Platform } from "react-native";
import * as Haptics from "expo-haptics";

type Props = PressableProps & {
  scaleTo?: number;
  haptic?: boolean | "light" | "medium" | "heavy";
  children: React.ReactNode;
  style?: any;
};

export default function PressableScale({
  scaleTo = 0.96,
  haptic = "light",
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handleIn = (e: any) => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
    if (haptic && Platform.OS !== "web") {
      const map: any = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      const style =
        haptic === true ? Haptics.ImpactFeedbackStyle.Light : map[haptic as string];
      Haptics.impactAsync(style).catch(() => {});
    }
    onPressIn && onPressIn(e);
  };

  const handleOut = (e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start();
    onPressOut && onPressOut(e);
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        {...rest}
        onPress={onPress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
