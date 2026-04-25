import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "./PressableScale";
import { colors, radius, shadow } from "./theme";

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "ghost" | "dark";
  size?: "md" | "lg";
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  haptic?: "light" | "medium" | "heavy";
};

export default function GradientButton({
  title,
  onPress,
  loading,
  disabled,
  icon,
  iconRight,
  variant = "primary",
  size = "md",
  style,
  textStyle,
  testID,
  haptic = "medium",
}: Props) {
  const height = size === "lg" ? 54 : 48;
  const isPrimary = variant === "primary";
  const isDark = variant === "dark";
  const isGhost = variant === "ghost";

  const inner = (
    <View style={[styles.row, { height }]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={isGhost ? colors.textPrimary : "#fff"}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles.text,
              isGhost && { color: colors.textPrimary },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {iconRight && (
            <Ionicons
              name={iconRight}
              size={18}
              color={isGhost ? colors.textPrimary : "#fff"}
              style={{ marginLeft: 8 }}
            />
          )}
        </>
      )}
    </View>
  );

  if (isPrimary) {
    return (
      <PressableScale
        haptic={haptic}
        onPress={disabled || loading ? undefined : onPress}
        style={[
          styles.wrapper,
          shadow.glow,
          { opacity: disabled ? 0.55 : 1 },
          style,
        ]}
        testID={testID}
      >
        <LinearGradient
          colors={["#3B82F6", "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderRadius: radius.md }]}
        >
          {inner}
        </LinearGradient>
      </PressableScale>
    );
  }

  if (isDark) {
    return (
      <PressableScale
        haptic={haptic}
        onPress={disabled || loading ? undefined : onPress}
        style={[
          styles.wrapper,
          shadow.md,
          { opacity: disabled ? 0.55 : 1 },
          style,
        ]}
        testID={testID}
      >
        <View style={[styles.gradient, { borderRadius: radius.md, backgroundColor: colors.primary }]}>
          {inner}
        </View>
      </PressableScale>
    );
  }

  // ghost
  return (
    <PressableScale
      haptic={haptic}
      onPress={disabled || loading ? undefined : onPress}
      style={[styles.wrapper, { opacity: disabled ? 0.55 : 1 }, style]}
      testID={testID}
    >
      <View
        style={[
          styles.gradient,
          {
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          },
        ]}
      >
        {inner}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  gradient: { width: "100%", justifyContent: "center", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  text: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.2 },
});
