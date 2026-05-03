import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
  Pressable, ScrollView, Platform, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, radius } from "./theme";
import { logoutLocal, getStoredUser, UserInfo } from "./api";

export type DrawerItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  onPress: () => void;
  variant?: "default" | "danger";
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: DrawerItem[];
};

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = Math.min(300, SCREEN_W * 0.82);

/**
 * Mobile-first left slide-out drawer for DocVault.
 *  - Translucent backdrop (dismisses on tap)
 *  - Slide + fade animation using Animated (native driver)
 *  - DocVault brand header, nav items, user footer with logout
 *  - Safe-area aware
 */
export default function MobileDrawer({ open, onClose, title, subtitle, items }: Props) {
  const tx = useRef(new Animated.Value(-DRAWER_W)).current;
  const op = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [me, setMe] = useState<UserInfo | null>(null);

  useEffect(() => {
    (async () => {
      try { setMe(await getStoredUser()); } catch {}
    })();
  }, [open]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(tx, {
        toValue: open ? 0 : -DRAWER_W,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(op, {
        toValue: open ? 1 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, tx, op]);

  const onLogout = async () => {
    await logoutLocal();
    onClose();
    router.replace("/");
  };

  // pointerEvents hack so the whole thing stays mounted but inert when closed.
  return (
    <View pointerEvents={open ? "auto" : "none"} style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: op }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { transform: [{ translateX: tx }], paddingTop: insets.top + 14 }]}>
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoMark}>DV</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>DocVault</Text>
            <Text style={styles.brandSub}>{title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        {/* Items */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.key}
              style={[
                styles.item,
                it.variant === "danger" && styles.itemDanger,
              ]}
              onPress={() => { it.onPress(); onClose(); }}
              activeOpacity={0.75}
            >
              {it.icon && <View style={styles.itemIcon}>{it.icon}</View>}
              <Text style={[
                styles.itemLabel,
                it.variant === "danger" && styles.itemLabelDanger,
              ]}>{it.label}</Text>
              {it.badge !== undefined && (
                <View style={styles.itemBadge}>
                  <Text style={styles.itemBadgeTxt}>{String(it.badge)}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.foot, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.userRow}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarTxt}>{(me?.name || "?").slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.userName} numberOfLines={1}>{me?.name || "User"}</Text>
              <Text style={styles.userRole}>{me?.role === "admin" ? "Admin" : me?.role === "client" ? "Client" : me?.role || ""}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutTxt}>↪ Log out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Minimal top bar with a hamburger button that triggers the drawer.
 * Use this at the top of screens that host the drawer.
 */
export function DrawerHeader({
  title, onMenu, right,
}: { title: string; onMenu: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[headerStyles.bar, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity onPress={onMenu} style={headerStyles.ham} hitSlop={8}>
        <View style={headerStyles.line} />
        <View style={[headerStyles.line, { width: 16 }]} />
        <View style={headerStyles.line} />
      </TouchableOpacity>
      <Text style={headerStyles.title} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 38, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: "#fff",
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 14,
    paddingBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDEEF2",
  },
  logo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  logoMark: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: -0.5 },
  brandName: { fontSize: 16, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  brandSub: {
    fontSize: 10, fontWeight: "800", color: colors.primary,
    letterSpacing: 0.8, textTransform: "uppercase", marginTop: 1,
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center",
  },
  closeTxt: { fontSize: 16, color: "#475569", fontWeight: "600" },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 10, paddingHorizontal: 4 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, marginTop: 4,
  },
  itemDanger: {},
  itemIcon: { width: 22, alignItems: "center" },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: "#334155" },
  itemLabelDanger: { color: "#B91C1C" },
  itemBadge: {
    backgroundColor: colors.primary, paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: radius.pill, minWidth: 22, alignItems: "center",
  },
  itemBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  foot: {
    borderTopWidth: 1, borderTopColor: "#EDEEF2",
    paddingTop: 12, marginTop: 4, gap: 10,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  userAvatarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  userName: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  userRole: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  logoutBtn: {
    paddingVertical: 10, borderRadius: 10, backgroundColor: "#F8FAFC",
    borderWidth: 1, borderColor: "#EDEEF2", alignItems: "center",
  },
  logoutTxt: { color: "#475569", fontWeight: "700", fontSize: 13 },
});

const headerStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EDEEF2",
    gap: 10,
    ...Platform.select({
      android: { paddingTop: (StatusBar.currentHeight || 0) + 6 },
    }),
  },
  ham: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center", gap: 3,
  },
  line: { width: 18, height: 2, borderRadius: 2, backgroundColor: "#0F172A" },
  title: {
    flex: 1, fontSize: 16, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3,
  },
});
