import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Animated, Easing, ActivityIndicator,
  ScrollView, TouchableOpacity, Linking, Alert, Image, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, gradients } from "../src/theme";
import PressableScale from "../src/PressableScale";
import { useAuth } from "../src/auth";
import SecurityBackground from "../src/SecurityBackground";
import { Ic } from "../src/Icons";
import TypingSlogan from "../src/TypingSlogan";

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [ready, setReady] = useState(false);
  const { width: screenW } = Dimensions.get("window");
  // device-width-aware logo/slogan sizing (phones 320-480 wide)
  const logoSize = Math.min(Math.max(screenW * 0.18, 60), 90);
  const sloganW = Math.min(Math.max(screenW * 0.5, 160), 240);
  const sloganH = sloganW * 0.2;

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(user.role === "admin" ? "/admin" : "/client");
      return;
    }
    setReady(true);
  }, [loading, user]);

  useEffect(() => {
    if (!ready) return;
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  // RoleCard — single tile per role with the role badge, tagline, and two
  // inline action buttons (Login / Register). Replaces the previous 4-card
  // layout so the landing page feels compact and tab-like.
  const RoleCard = ({
    role, gradient, dark = false, headerIcon, title, sub, lockIcon, clipboardIcon,
  }: {
    role: "client" | "admin";
    gradient?: string[];
    dark?: boolean;
    headerIcon: keyof typeof Ionicons.glyphMap;
    title: string;
    sub: string;
    lockIcon: keyof typeof Ionicons.glyphMap;
    clipboardIcon: keyof typeof Ionicons.glyphMap;
  }) => {
    const Container: any = gradient ? LinearGradient : View;
    const containerProps = gradient
      ? { colors: gradient, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }
      : {};
    return (
      <View style={[styles.roleCard, dark && styles.roleCardDark]}>
        <Container {...containerProps} style={[styles.roleHeader, dark && styles.roleHeaderDark]}>
          <View style={[styles.roleHeaderIcon, dark && styles.roleHeaderIconDark]}>
            <Ionicons name={headerIcon} size={22} color={dark ? "#fff" : "#3B82F6"} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.roleHeaderTitle} numberOfLines={2}>{title}</Text>
            <Text style={[styles.roleHeaderSub, dark && styles.roleHeaderSubDark]} numberOfLines={2}>{sub}</Text>
          </View>
        </Container>
        <View style={styles.roleActions}>
          <PressableScale
            onPress={() => router.push(`/${role}/login`)}
            testID={`btn-${role}-login`}
            style={{ flex: 1 }}
          >
            <View style={styles.roleAction}>
              <Ic kind="login" size={20} />
              <Text style={styles.roleActionText} numberOfLines={1}>Login</Text>
            </View>
          </PressableScale>
          <PressableScale
            onPress={() => router.push(`/${role}/register`)}
            testID={`btn-${role}-register`}
            style={{ flex: 1 }}
          >
            <View style={[styles.roleAction, styles.roleActionAlt]}>
              <Ic kind="register" size={20} />
              <Text style={[styles.roleActionText, { color: "#fff" }]} numberOfLines={1}>Register</Text>
            </View>
          </PressableScale>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SecurityBackground />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
          <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroSlide }], maxWidth: 640, alignSelf: "center", width: "100%" }}>
            <View style={styles.logoWrap}>
              <Image
                source={require("../assets/images/brand-logo.png")}
                style={{ width: logoSize, height: logoSize }}
                resizeMode="contain"
              />
            </View>
            <View style={{ width: sloganW, alignSelf: "center", marginTop: 8, marginBottom: 4 }}>
              <TypingSlogan fontSize={Math.max(12, Math.round(sloganW * 0.062))} width={sloganW} align="center" />
            </View>
            <Text style={styles.tagline}>Per-client privacy. Real-time sync.{"\n"}Same data on web & mobile.</Text>
          </Animated.View>

          <View style={{ height: 28 }} />

          <View style={{ height: 18 }} />

          <TouchableOpacity
            onPress={async () => {
              const url = "https://doc-organizer-app.emergent.host/";
              try {
                const ok = await Linking.canOpenURL(url);
                if (ok) await Linking.openURL(url);
                else Alert.alert("Web version", url);
              } catch {
                Alert.alert("Web version", url);
              }
            }}
            activeOpacity={0.85}
            style={styles.webRow}
            testID="btn-open-web-version"
          >
            <View style={styles.webIcon}>
              <Image
                source={{ uri: "https://img.icons8.com/3d-fluency/94/chrome-browser.png" }}
                style={{ width: 26, height: 26 }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.webTitle} numberOfLines={2}>Open Web Version</Text>
              <Text style={styles.webSub} numberOfLines={2}>doc-organizer-app.emergent.host</Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#CBD5E1" />
          </TouchableOpacity>

          <View style={{ height: 10 }} />

          <View style={{ maxWidth: 640, alignSelf: "center", width: "100%", gap: 14 }}>
            <RoleCard
              role="client"
              gradient={["#3B82F6", "#8B5CF6"]}
              headerIcon="people"
              title="I'm a Client"
              sub="Browse documents shared with you"
              lockIcon="lock-closed"
              clipboardIcon="clipboard"
            />
            <RoleCard
              role="admin"
              dark
              headerIcon="shield-checkmark"
              title="I'm an Admin"
              sub="Manage your clients & documents"
              lockIcon="lock-open"
              clipboardIcon="document-text"
            />
          </View>

          <View style={{ flex: 1 }} />
          <View style={styles.footer}><Ionicons name="lock-closed" size={11} color="#64748B" /><Text style={styles.footerText}>Encrypted · End-to-end controlled</Text></View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  logoWrap: { alignItems: "center", justifyContent: "center", marginBottom: 10, alignSelf: "flex-start" },
  brand: { fontSize: 40, fontWeight: "800", color: "#fff", letterSpacing: -1.2 },
  tagline: { fontSize: 14, color: "#CBD5E1", marginTop: 8, lineHeight: 20 },
  section: { color: "#94A3B8", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 },
  cardPrimary: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: 14 },
  cardSecondary: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  cardSecondaryDark: {},
  // === New compact RoleCard layout (replaces old 4-card section) ===
  roleCard: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  roleCardDark: {
    backgroundColor: "rgba(15,23,42,0.55)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  roleHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  roleHeaderDark: {
    backgroundColor: "transparent",
  },
  roleHeaderIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  roleHeaderIconDark: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  roleHeaderTitle: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  roleHeaderSub:   { color: "#E0E7FF", fontSize: 12, marginTop: 2 },
  roleHeaderSubDark: { color: "#94A3B8" },
  roleActions: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4,
  },
  roleAction: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: radius.md,
  },
  roleActionAlt: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.30)",
  },
  roleActionText: { color: "#1E293B", fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  cardIconLight: { width: 42, height: 42, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardIconDark: { width: 42, height: 42, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  cardSub: { color: "#E0E7FF", fontSize: 12, marginTop: 2 },
  cardSubDark: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  chev: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  chevGhost: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  footer: { marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: 0.7 },
  footerText: { color: "#94A3B8", fontSize: 11 },
  webRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.lg,
    maxWidth: 640, alignSelf: "center", width: "100%",
  },
  webIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.85)",
    alignItems: "center", justifyContent: "center",
  },
  webTitle: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  webSub: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
});
