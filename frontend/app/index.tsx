import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Image, Pressable, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../src/auth";

// APK direct-download link — same as web's `dv-apk-inline`
const APK_URL =
  (process.env.EXPO_PUBLIC_APK_URL as string | undefined) ||
  "https://expo.dev/artifacts/eas/e6jGMGCfQQ1arLMmiJHdaq.apk";

const SUPER_ADMIN_EMAIL = "mansijmandal1999@gmail.com";
const UNLOCK_KEY = "dv_super_unlock";
const SUPER_ADMIN_BTN_URL =
  (process.env.EXPO_PUBLIC_BACKEND_URL as string | undefined)
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/web/super-admin-btn.png`
    : "https://customer-assets.emergentagent.com/job_doc-organizer-app/artifacts/sy3jz0lp_SUPER%20ADMIN.png";

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [ready, setReady] = useState(false);

  // Responsive hero logo size — tracks the screenshot reference (~140-180px)
  const { width: screenW } = Dimensions.get("window");
  const logoSize = Math.min(Math.max(screenW * 0.36, 120), 180);

  // Super-admin reveal: persistent flag OR specific email match,
  // plus a hidden gesture (tap brand mark 5× quickly) to unlock.
  const [superUnlocked, setSuperUnlocked] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(user.role === "admin" ? "/admin" : "/client");
      return;
    }
    setReady(true);
    (async () => {
      const flag = await AsyncStorage.getItem(UNLOCK_KEY);
      const emailMatch = (user as any)?.email?.toLowerCase?.() === SUPER_ADMIN_EMAIL;
      setSuperUnlocked(flag === "1" || emailMatch);
    })();
  }, [loading, user]);

  const handleSecretTap = async () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      await AsyncStorage.setItem(UNLOCK_KEY, "1");
      setSuperUnlocked(true);
    }
  };

  if (!ready) {
    return <View style={styles.root} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ─────── NAV ─────── */}
        <View style={styles.nav}>
          <Pressable onPress={handleSecretTap} style={styles.brand} hitSlop={6}>
            <Image
              source={require("../assets/images/brand-logo.png")}
              style={styles.brandMark}
              resizeMode="contain"
            />
            <Image
              source={require("../assets/images/brand-wordmark.png")}
              style={styles.brandWordmark}
              resizeMode="contain"
            />
          </Pressable>

          <View style={styles.navRight}>
            {superUnlocked && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/superadmin/login" as any)}
                style={{ marginRight: 8 }}
              >
                <Image source={{ uri: SUPER_ADMIN_BTN_URL }} style={styles.superBtn} resizeMode="contain" />
              </TouchableOpacity>
            )}
            {/* Download APK — green pill (replaces "Watch on browser" on mobile app) */}
            <TouchableOpacity
              style={styles.apkBtn}
              activeOpacity={0.85}
              onPress={() => Linking.openURL(APK_URL)}
              hitSlop={4}
            >
              <Text style={styles.apkBtnIcon}>📱</Text>
              <Text style={styles.apkBtnText}>Download APK</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─────── HERO ROW: Logo (left) + Headline (right) — SIDE-BY-SIDE ─────── */}
        <View style={styles.heroRow}>
          <Image
            source={require("../assets/images/brand-logo.png")}
            style={[styles.heroLogo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
          />
          <View style={styles.headlineCol}>
            <Text style={styles.headlineLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
              Organised PDF storage.
            </Text>
            <Text style={styles.headlineLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
              Per-client privacy.
            </Text>
            <Text style={[styles.headlineLine, styles.headlineGreen]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
              Real-time sync.
            </Text>
            <View style={styles.pillUnderHead}>
              <Text style={styles.pillUnderHeadText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                Secure. Organised. Always Accessible.
              </Text>
            </View>
          </View>
        </View>

        {/* ─────── FEATURE PILLS — single horizontal row, 4 pills fit ─────── */}
        <View style={styles.featurePills}>
          <FeaturePill icon="⚡" label="Auto-categorise"     bg="#FEFCE8" border="rgba(234,179,8,0.35)" />
          <FeaturePill icon="🔗" label="One-tap share"       bg="#EFF6FF" border="rgba(59,130,246,0.35)" />
          <FeaturePill icon="🔴" label="Real-time sync"      bg="#FEF2F2" border="rgba(239,68,68,0.35)" />
          <FeaturePill icon="🔒" label="Per-client privacy"  bg="#FAF5FF" border="rgba(168,85,247,0.35)" />
        </View>

        {/* ─────── SUB TEXT — centered ─────── */}
        <Text style={styles.subText}>
          DocVault helps teams and professionals securely store, organise and share PDFs
          with complete control and peace of mind.
        </Text>

        {/* ─────── ROLE CARDS ─────── */}
        <View style={styles.roleCard}>
          <View style={styles.roleCardHead}>
            <View style={styles.roleIc}><Text style={styles.roleIcEmoji}>👤</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleCardTitle}>I'm a Client</Text>
              <Text style={styles.roleCardSub}>Access documents shared with you</Text>
            </View>
          </View>
          <View style={styles.roleBtnRow}>
            <TouchableOpacity
              style={styles.gradBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/client/login" as any)}
            >
              <Text style={styles.gradBtnText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/client/register" as any)}
            >
              <Text style={styles.outlineBtnText}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.roleCard}>
          <View style={styles.roleCardHead}>
            <View style={[styles.roleIc, styles.roleIcAdmin]}><Text style={styles.roleIcEmoji}>🛡️</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleCardTitle}>I'm an Admin</Text>
              <Text style={styles.roleCardSub}>Manage clients & documents</Text>
            </View>
          </View>
          <View style={styles.roleBtnRow}>
            <TouchableOpacity
              style={styles.gradBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/admin/login" as any)}
            >
              <Text style={styles.gradBtnText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/admin/register" as any)}
            >
              <Text style={styles.outlineBtnText}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─────── FOOTER ─────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 DocVault. All rights reserved.</Text>
          <Text style={styles.footerSubText}>
            Organised PDF storage · Per-client privacy · Real-time sync
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeaturePill({ icon, label, bg, border }: { icon: string; label: string; bg: string; border: string }) {
  return (
    <View style={[styles.fpill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={styles.fpillIcon}>{icon}</Text>
      <Text style={styles.fpillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingBottom: 32 },

  // Header
  nav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
    backgroundColor: "rgba(255,255,255,0.95)",
    gap: 10,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  brandMark: { width: 38, height: 38 },
  brandWordmark: { width: 92, height: 22 },
  navRight: { flexDirection: "row", alignItems: "center" },
  superBtn: { width: 70, height: 36 },

  // Download APK CTA — green pill matching web .dv-apk-inline
  apkBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#10B981",
    shadowColor: "#10B981", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  apkBtnIcon: { fontSize: 13 },
  apkBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13, letterSpacing: 0.1 },

  // Hero — logo (left) + headline (right) side-by-side
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 14,
    gap: 12,
  },
  heroLogo: {
    shadowColor: "#6366F1", shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 22 },
    elevation: 6,
  },
  headlineCol: { flex: 1, alignItems: "flex-start" },
  headlineLine: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 23,
    color: "#3B82F6",
    textAlign: "left",
  },
  headlineGreen: { color: "#08C488" },

  // Pill under headline
  pillUnderHead: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.10)",
    borderWidth: 1, borderColor: "rgba(99,102,241,0.22)",
    maxWidth: "100%",
  },
  pillUnderHeadText: { fontSize: 11, fontWeight: "600", color: "#4F46E5", letterSpacing: 0.1 },

  // Feature pills — single line row, 4 pills equal-width
  featurePills: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
    width: "100%",
  },
  fpill: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
    overflow: "hidden",
  },
  fpillIcon: { fontSize: 9, marginRight: 3 },
  fpillText: { fontSize: 9, fontWeight: "600", color: "#334155", letterSpacing: -0.2 },

  // Sub-text — centered
  subText: {
    fontSize: 14, lineHeight: 21, color: "#475569",
    paddingHorizontal: 24, marginBottom: 18, textAlign: "center",
  },

  // Role cards
  roleCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 18,
    shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  roleCardHead: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  roleIc: {
    width: 52, height: 52, borderRadius: 13,
    backgroundColor: "rgba(99,102,241,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  roleIcAdmin: { backgroundColor: "rgba(245,158,11,0.18)" },
  roleIcEmoji: { fontSize: 26 },
  roleCardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  roleCardSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  roleBtnRow: { flexDirection: "row", gap: 10 },

  gradBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  gradBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  outlineBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#CBD5E1",
  },
  outlineBtnText: { color: "#0F172A", fontWeight: "600", fontSize: 14 },

  footer: {
    alignItems: "center", marginTop: 18, paddingTop: 18, paddingBottom: 4,
    paddingHorizontal: 24,
    borderTopWidth: 1, borderTopColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  footerText: { color: "#64748B", fontSize: 12, marginBottom: 4 },
  footerSubText: { color: "#94A3B8", fontSize: 11, textAlign: "center" },
});
