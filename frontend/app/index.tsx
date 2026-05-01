import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Image, Dimensions, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../src/auth";

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
  const { width: screenW } = Dimensions.get("window");

  // Responsive sizes — smaller hero logo, left-aligned
  const logoSize = Math.min(Math.max(screenW * 0.32, 110), 150);

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
        {/* ─────── HEADER (brand + optional super-admin button) ─────── */}
        <View style={styles.header}>
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
          {superUnlocked && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/superadmin/login" as any)}
            >
              <Image source={{ uri: SUPER_ADMIN_BTN_URL }} style={styles.superBtn} resizeMode="contain" />
            </TouchableOpacity>
          )}
        </View>

        {/* ─────── HERO LOGO + HEADLINE (side by side) ─────── */}
        <View style={styles.heroRow}>
          <Image
            source={require("../assets/images/brand-logo.png")}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
          />
          <View style={styles.headlineWrap}>
            <Text style={styles.headline}>Organised PDF storage.</Text>
            <Text style={styles.headline}>Per-client privacy.</Text>
            <Text style={[styles.headline, styles.headlineGreen]}>Real-time sync.</Text>
          </View>
        </View>

        {/* ─────── PILL ─────── */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Secure. Organised. Always Accessible.</Text>
          </View>
        </View>

        {/* ─────── FEATURE PILLS ─────── */}
        <View style={styles.featurePills}>
          <FeaturePill icon="⚡" label="Auto-categorise" tint="#FACC15" bg="#FEFCE8" />
          <FeaturePill icon="🔗" label="One-tap share" tint="#3B82F6" bg="#EFF6FF" />
          <FeaturePill icon="🔴" label="Real-time sync" tint="#EF4444" bg="#FEF2F2" />
          <FeaturePill icon="🔒" label="Per-client privacy" tint="#A855F7" bg="#FAF5FF" />
        </View>

        {/* ─────── SUB TEXT ─────── */}
        <Text style={styles.subText}>
          DocVault helps teams and professionals securely store, organise and share PDFs
          with complete control and peace of mind.
        </Text>

        {/* ─────── APK BUTTON ─────── */}
        <TouchableOpacity
          style={styles.apkBtn}
          activeOpacity={0.85}
          onPress={() => Linking.openURL(APK_URL)}
        >
          <Text style={styles.apkBtnText}>📱 Download Android App (.apk)</Text>
        </TouchableOpacity>

        {/* ─────── ROLE CARDS ─────── */}
        <View style={styles.roleCard}>
          <View style={styles.roleCardHead}>
            <View style={styles.roleIcCircle}>
              <Text style={styles.roleIcEmoji}>👤</Text>
            </View>
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
            <View style={[styles.roleIcCircle, styles.roleIcAdmin]}>
              <Text style={styles.roleIcEmoji}>🛡️</Text>
            </View>
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

function FeaturePill({ icon, label, tint, bg }: { icon: string; label: string; tint: string; bg: string }) {
  return (
    <View style={[styles.fpill, { backgroundColor: bg, borderColor: tint + "55" }]}>
      <Text style={styles.fpillIcon}>{icon}</Text>
      <Text style={styles.fpillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 36, height: 36 },
  brandWordmark: { width: 96, height: 22 },
  superBtn: { width: 78, height: 40 },

  // Hero logo — left-aligned, smaller
  heroLogoWrap: {
    alignItems: "flex-start", justifyContent: "flex-start",
    paddingHorizontal: 20,
    marginTop: 20, marginBottom: 18,
  },

  // Hero row — logo + headline side by side
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },

  // Headline
  headlineWrap: { flex: 1, paddingHorizontal: 0, marginBottom: 0 },
  headline: {
    fontSize: 16, fontWeight: "800", letterSpacing: -0.3,
    color: "#3B82F6", textAlign: "left", lineHeight: 21,
  },
  headlineGreen: { color: "#08C488" },

  // Pill
  pillRow: { alignItems: "center", marginBottom: 14 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.10)",
    borderWidth: 1, borderColor: "rgba(99,102,241,0.22)",
  },
  pillText: { fontSize: 12, fontWeight: "600", color: "#4F46E5" },

  // Feature pills
  featurePills: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "center", gap: 8,
    paddingHorizontal: 24, marginBottom: 18,
  },
  fpill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  fpillIcon: { fontSize: 11 },
  fpillText: { fontSize: 11, fontWeight: "600", color: "#334155" },

  // Sub text
  subText: {
    fontSize: 14, lineHeight: 20, color: "#475569",
    paddingHorizontal: 24, marginBottom: 18, textAlign: "center",
  },

  // APK button
  apkBtn: {
    alignSelf: "center", paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 12, backgroundColor: "#10B981",
    shadowColor: "#10B981", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    marginBottom: 28, elevation: 4,
  },
  apkBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  // Role cards
  roleCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: "#FFF", borderWidth: 1.5, borderColor: "#E2E8F0",
    borderRadius: 16, padding: 18,
    shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  roleCardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  roleIcCircle: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "rgba(99,102,241,0.14)",
    alignItems: "center", justifyContent: "center",
  },
  roleIcAdmin: { backgroundColor: "rgba(245,158,11,0.18)" },
  roleIcEmoji: { fontSize: 24 },
  roleCardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  roleCardSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  roleBtnRow: { flexDirection: "row", gap: 10 },

  // Buttons
  gradBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  gradBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  outlineBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFF", borderWidth: 1.5, borderColor: "#CBD5E1",
  },
  outlineBtnText: { color: "#0F172A", fontWeight: "600", fontSize: 14 },

  // Footer
  footer: {
    alignItems: "center", marginTop: 24, paddingTop: 18,
    borderTopWidth: 1, borderTopColor: "#E2E8F0",
    paddingHorizontal: 24,
  },
  footerText: { color: "#64748B", fontSize: 12, marginBottom: 4 },
  footerSubText: { color: "#94A3B8", fontSize: 11, textAlign: "center" },
});
