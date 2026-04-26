/**
 * Toast — global lightweight notification system for mobile.
 *
 * Usage:
 *   <ToastProvider>{children}</ToastProvider>   // mount once at root
 *   const toast = useToast();
 *   toast.show("Document uploaded", { kind: "info" });
 *
 * Types: "info" | "success" | "warn" | "error"
 *
 * Renders one floating toast at a time at the top-center of the screen using
 * react-native-reanimated for slide+fade. Auto-dismisses after `durationMs`
 * (default 3000ms). Tap the toast to dismiss early.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

export type ToastKind = "info" | "success" | "warn" | "error";

type ToastOptions = {
  kind?: ToastKind;
  durationMs?: number;
  icon?: keyof typeof Ionicons.glyphMap;
};

type ToastItem = ToastOptions & { id: number; message: string };

type ToastCtxValue = {
  show: (message: string, opts?: ToastOptions) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastCtxValue | null>(null);

const COLORS: Record<ToastKind, { bg: string; border: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info:    { bg: "#1E40AF", border: "#3B82F6", fg: "#fff", icon: "information-circle" },
  success: { bg: "#065F46", border: "#10B981", fg: "#fff", icon: "checkmark-circle" },
  warn:    { bg: "#92400E", border: "#F59E0B", fg: "#fff", icon: "alert-circle" },
  error:   { bg: "#7F1D1D", border: "#EF4444", fg: "#fff", icon: "close-circle" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const insets = useSafeAreaInsets();
  const idCounter = useRef(0);
  const timerRef = useRef<any>(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setItem(null);
  }, []);

  const show = useCallback((message: string, opts: ToastOptions = {}) => {
    const id = ++idCounter.current;
    const next: ToastItem = { id, message, kind: opts.kind ?? "info", durationMs: opts.durationMs ?? 3000, icon: opts.icon };
    if (timerRef.current) clearTimeout(timerRef.current);
    setItem(next);
    timerRef.current = setTimeout(() => {
      // Only dismiss if still showing the same item.
      setItem((cur) => (cur && cur.id === id ? null : cur));
      timerRef.current = null;
    }, next.durationMs);
  }, []);

  const ctx: ToastCtxValue = { show, hide };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {item && (
        <Animated.View
          key={item.id}
          entering={FadeInUp.duration(220).springify().damping(16)}
          exiting={FadeOutUp.duration(180)}
          style={[
            styles.wrapper,
            { top: insets.top + 12 },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={hide}
            style={[
              styles.card,
              { backgroundColor: COLORS[item.kind!].bg, borderColor: COLORS[item.kind!].border },
            ]}
          >
            <Ionicons
              name={item.icon || COLORS[item.kind!].icon}
              size={20}
              color={COLORS[item.kind!].fg}
            />
            <Text style={[styles.text, { color: COLORS[item.kind!].fg }]} numberOfLines={2}>
              {item.message}
            </Text>
            <Ionicons name="close" size={16} color={"rgba(255,255,255,0.7)"} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op in case ToastProvider isn't mounted yet.
    return {
      show: (_m: string, _o?: ToastOptions) => {},
      hide: () => {},
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0, right: 0,
    paddingHorizontal: 16,
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 280,
    maxWidth: 480,
    width: "100%",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.20, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  text: { flex: 1, fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
});
