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
          <TouchableOpacity
            style={styles.navWatchBtn}
            activeOpacity={0.85}
            onPress={() => Linking.openURL("https://doc-organizer-app.emergent.host/")}
          >
            <Image
              source={{ uri: "data:image/png;base64,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" }}
              style={styles.navWatchIcon}
              resizeMode="contain"
            />
            <Text style={styles.navWatchText}>Watch on website</Text>
          </TouchableOpacity>
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
            <View style={styles.pillInline}>
              <Text style={styles.pillText}>Secure. Organised. Always Accessible.</Text>
            </View>
          </View>
        </View>

        {/* ─────── FEATURE PILLS (full labels, compact, single line) ─────── */}
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
      <Text style={styles.fpillIcon} numberOfLines={1}>{icon}</Text>
      <Text style={styles.fpillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
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

  // Pill — inline, sits directly under "Real-time sync."
  pillInline: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.10)",
    borderWidth: 1, borderColor: "rgba(99,102,241,0.22)",
  },
  pillText: { fontSize: 11, fontWeight: "600", color: "#4F46E5" },

  // Feature pills — equal-width row, all 4 full labels fit in screen
  featurePills: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 18,
    alignItems: "center",
    width: "100%",
  },
  fpill: {
    flex: 1,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    width: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 3, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  fpillIcon: { fontSize: 7, marginRight: 2 },
  fpillText: {
    fontSize: 7.5,
    fontWeight: "700",
    color: "#334155",
    letterSpacing: -0.3,
  },

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
