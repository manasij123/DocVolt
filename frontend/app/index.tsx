import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Animated, Easing, ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, gradients } from "../src/theme";
import PressableScale from "../src/PressableScale";
import { useAuth } from "../src/auth";

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [ready, setReady] = useState(false);

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

  const Card = ({ icon, gradient, title, sub, onPress, dark = false, testID }: any) => (
    <PressableScale onPress={onPress} testID={testID}>
      {gradient ? (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardPrimary}>
          <View style={styles.cardIconLight}><Ionicons name={icon} size={22} color="#3B82F6" /></View>
          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{sub}</Text>
          </View>
          <View style={styles.chev}><Ionicons name="arrow-forward" size={18} color="#fff" /></View>
        </LinearGradient>
      ) : (
        <View style={[styles.cardSecondary, dark && styles.cardSecondaryDark]}>
          <View style={styles.cardIconDark}><Ionicons name={icon} size={22} color="#fff" /></View>
          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.cardSubDark} numberOfLines={1}>{sub}</Text>
          </View>
          <View style={styles.chevGhost}><Ionicons name="arrow-forward" size={18} color="#CBD5E1" /></View>
        </View>
      )}
    </PressableScale>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
          <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroSlide }], maxWidth: 640, alignSelf: "center", width: "100%" }}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoWrap}>
              <Ionicons name="document-text" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.brand}>DocVault</Text>
            <Text style={styles.tagline}>Per-client privacy. Real-time sync.{"\n"}Same data on web & mobile.</Text>
          </Animated.View>

          <View style={{ height: 28 }} />

          <View style={{ maxWidth: 640, alignSelf: "center", width: "100%", gap: 12 }}>
            <Text style={styles.section}>I'm a Client</Text>
            <Card icon="people" gradient={["#3B82F6", "#8B5CF6"]} title="Client — Login" sub="Browse documents shared with you"
              onPress={() => router.push("/client/login")} testID="btn-client-login" />
            <Card icon="sparkles" title="Client — Register" sub="Create an account & connect with your admin" dark
              onPress={() => router.push("/client/register")} testID="btn-client-register" />

            <View style={{ height: 8 }} />
            <Text style={styles.section}>I'm an Admin</Text>
            <Card icon="shield-checkmark" title="Admin — Login" sub="Manage your clients & documents" dark
              onPress={() => router.push("/admin/login")} testID="btn-admin-login" />
            <Card icon="rocket" title="Admin — Register" sub="Set up your own admin workspace" dark
              onPress={() => router.push("/admin/register")} testID="btn-admin-register" />
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
  logoWrap: { width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  brand: { fontSize: 40, fontWeight: "800", color: "#fff", letterSpacing: -1.2 },
  tagline: { fontSize: 14, color: "#CBD5E1", marginTop: 8, lineHeight: 20 },
  section: { color: "#94A3B8", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 },
  cardPrimary: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: 14 },
  cardSecondary: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  cardSecondaryDark: {},
  cardIconLight: { width: 42, height: 42, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardIconDark: { width: 42, height: 42, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  cardSub: { color: "#E0E7FF", fontSize: 12, marginTop: 2 },
  cardSubDark: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  chev: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  chevGhost: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  footer: { marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: 0.7 },
  footerText: { color: "#94A3B8", fontSize: 11 },
});
