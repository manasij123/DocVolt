import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Image, Pressable,
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
        {/* ─────── HEADER (sticky-style: brand + APK download CTA on right) ─────── */}
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
            {/* Download APK button (replaces "Watch on browser") */}
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

        {/* ─────── HERO (web mobile-responsive: headline first, then logo+sub, then role cards) ─────── */}
        <View style={styles.hero}>
          {/* Middle column on web — headline + pill + feature pills (order: -1 on mobile) */}
          <View style={styles.headlineMid}>
            <Text style={styles.headlineLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              Organised PDF storage.
            </Text>
            <Text style={styles.headlineLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              Per-client privacy.
            </Text>
            <Text style={[styles.headlineLine, styles.headlineGreen]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              Real-time sync.
            </Text>

            <View style={styles.pillUnderHead}>
              <Text style={styles.pillUnderHeadText}>
                Secure. Organised. Always Accessible.
              </Text>
            </View>

            <View style={styles.featurePills}>
              <FeaturePill icon="⚡" label="Auto-categorise"     bg="#FEFCE8" border="rgba(234,179,8,0.35)" />
              <FeaturePill icon="🔗" label="One-tap share"       bg="#EFF6FF" border="rgba(59,130,246,0.35)" />
              <FeaturePill icon="🔴" label="Real-time sync"      bg="#FEF2F2" border="rgba(239,68,68,0.35)" />
              <FeaturePill icon="🔒" label="Per-client privacy"  bg="#FAF5FF" border="rgba(168,85,247,0.35)" />
            </View>
          </View>

          {/* Left column on web — 3D hero logo + sub-text. (No inline APK button — moved to navbar) */}
          <View style={styles.heroLeft}>
            <Image
              source={require("../assets/images/brand-logo.png")}
              style={styles.heroLogoCard}
              resizeMode="contain"
            />
            <Text style={styles.heroSub}>
              DocVault helps teams and professionals securely store, organise and share PDFs
              with complete control and peace of mind.
            </Text>
          </View>

          {/* Right column on web — role cards stack */}
          <View style={styles.heroRight}>
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
      <Text style={styles.fpillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // matches .dv-landing-light — pure white background
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingBottom: 32 },

  // ── Header (.dv-nav / .dv-nav-inner) ──
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

  // ── Hero (.dv-hero-simple at <760px → single column with order: -1 on headline) ──
  hero: {
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12,
    gap: 28,
  },

  // Headline-mid block (.dv-hero-headline-mid) — comes FIRST on mobile
  headlineMid: { gap: 14, alignItems: "flex-start" },
  // .dv-headline-static — clamp(26..38px), letter-spacing -0.8, line-height 1.22, weight 800
  headlineLine: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 36,
    textAlign: "left",
    // Blue → indigo → purple gradient on web; RN can't do gradient text inline,
    // so we use the dominant indigo color #6366F1 for lines 1 & 2.
    color: "#6366F1",
  },
  // Line 3 — green (.dv-grad-text inside .dv-headline-static)
  headlineGreen: { color: "#08C488" },

  // Pill under headline (.dv-pill-under-head) — gradient soft pill
  pillUnderHead: {
    alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1, borderColor: "rgba(99,102,241,0.22)",
  },
  pillUnderHeadText: { fontSize: 12, fontWeight: "600", color: "#4F46E5", letterSpacing: 0.2 },

  // Feature pills (.dv-feature-pills .dv-nav-pill, all 4 in one wrapped row)
  featurePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    width: "100%",
  },
  fpill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  fpillIcon: { fontSize: 11, marginRight: 4 },
  fpillText: { fontSize: 11.5, fontWeight: "600", color: "#334155", letterSpacing: -0.1 },

  // Hero left (.dv-hero-simple-left) — logo card (140px on mobile per CSS @media 760)
  heroLeft: { alignItems: "flex-start", gap: 14 },
  heroLogoCard: {
    width: 140, height: 140,
    // simulate web's drop-shadow filter via RN shadow + elevation
    shadowColor: "#6366F1", shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 22 },
    elevation: 6,
  },
  heroSub: {
    fontSize: 14, lineHeight: 21, color: "#475569",
    fontWeight: "400",
  },

  // Hero right (.dv-hero-simple-right / .dv-role-grid-lg) — stack of 2 role cards
  heroRight: { gap: 16 },

  // Role card (.dv-role-card-lg)
  roleCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 20,
    shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  roleCardHead: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  // .dv-role-ic-lg — 56×56 with soft indigo→purple gradient (we use a tinted bg)
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

  // Buttons (.dv-gradient-btn / .dv-outline-btn) — at <480px the row stays 1fr 1fr per CSS
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

  // Footer (.dv-footer-simple)
  footer: {
    alignItems: "center", marginTop: 24, paddingTop: 18, paddingBottom: 4,
    paddingHorizontal: 24,
    borderTopWidth: 1, borderTopColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  footerText: { color: "#64748B", fontSize: 12, marginBottom: 4 },
  footerSubText: { color: "#94A3B8", fontSize: 11, textAlign: "center" },
});
