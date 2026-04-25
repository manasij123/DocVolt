import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, gradients } from "../src/theme";
import PressableScale from "../src/PressableScale";
import { getLastRole, getToken, setLastRole } from "../src/api";

const { width } = Dimensions.get("window");

export default function Landing() {
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(true);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(40)).current;
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;
  const orb = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;

  // Auto-redirect if user has a saved role (WhatsApp/FB-style persistent login)
  useEffect(() => {
    (async () => {
      try {
        const role = await getLastRole();
        if (role === "client") {
          router.replace("/client/monthly");
          return;
        }
        if (role === "admin") {
          const token = await getToken();
          if (token) {
            router.replace("/admin/(tabs)/upload");
            return;
          }
        }
      } catch {
        // ignore — fall through to chooser
      }
      setBootstrapping(false);
    })();
  }, []);

  useEffect(() => {
    if (bootstrapping) return;
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.stagger(140, [
      Animated.spring(card1, { toValue: 1, useNativeDriver: true, friction: 8, tension: 40 }),
      Animated.spring(card2, { toValue: 1, useNativeDriver: true, friction: 8, tension: 40 }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orb, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2, { toValue: 1, duration: 7500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orb2, { toValue: 0, duration: 7500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [bootstrapping]);

  const onClient = async () => {
    await setLastRole("client");
    router.replace("/client/monthly");
  };

  const onAdmin = () => {
    router.push("/admin/login");
  };

  const orbY = orb.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
  const orbX = orb.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, 30] });
  const orb2X = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });

  const cardTransform = (v: Animated.Value) => ({
    opacity: v,
    transform: [
      {
        translateY: v.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }),
      },
    ],
  });

  return (
    <View style={styles.root} testID="landing-screen">
      {/* Background gradient */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {bootstrapping ? (
        <View style={styles.bootWrap}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <>
      {/* Floating gradient orbs */}
      <Animated.View
        style={[
          styles.orbBlue,
          {
            transform: [{ translateX: orbX }, { translateY: orbY }],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(59,130,246,0.95)", "rgba(59,130,246,0)"]}
          style={styles.orbInner}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.orbViolet,
          {
            transform: [{ translateX: orb2X }, { translateY: orb2Y }],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(139,92,246,0.95)", "rgba(139,92,246,0)"]}
          style={styles.orbInner}
        />
      </Animated.View>

      {/* Subtle grid lines */}
      <View pointerEvents="none" style={styles.gridOverlay} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Animated.View
          style={[styles.header, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}
        >
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoWrap}
          >
            <Ionicons name="document-text" size={28} color="#fff" />
          </LinearGradient>

          <Text style={styles.brand}>DocVault</Text>
          <Text style={styles.tagline}>
            Organised PDF storage for your team —{"\n"}fast, beautiful, share-ready.
          </Text>

          <View style={styles.featureRow}>
            <View style={styles.featurePill}>
              <Ionicons name="flash" size={12} color="#A5B4FC" />
              <Text style={styles.featureText}>Auto-categorise</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="share-social" size={12} color="#A5B4FC" />
              <Text style={styles.featureText}>One-tap share</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.bottom}>
          <Text style={styles.chooseText}>Continue as</Text>

          <Animated.View style={cardTransform(card1)}>
            <PressableScale
              haptic="medium"
              onPress={onClient}
              testID="btn-client-access"
            >
              <LinearGradient
                colors={["#3B82F6", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                <View style={styles.btnIconWrap}>
                  <Ionicons name="people" size={22} color="#3B82F6" />
                </View>
                <View style={styles.btnTextWrap}>
                  <Text style={styles.btnTitle} numberOfLines={1}>Client</Text>
                  <Text style={styles.btnSub} numberOfLines={1}>Browse and share documents</Text>
                </View>
                <View style={styles.chevWrap}>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </LinearGradient>
            </PressableScale>
          </Animated.View>

          <Animated.View style={cardTransform(card2)}>
            <PressableScale
              haptic="light"
              onPress={onAdmin}
              testID="btn-admin-access"
            >
              <View style={styles.secondaryBtn}>
                <View style={styles.btnIconDarkWrap}>
                  <Ionicons name="shield-checkmark" size={22} color="#fff" />
                </View>
                <View style={styles.btnTextWrap}>
                  <Text style={styles.btnTitleDark} numberOfLines={1}>Admin</Text>
                  <Text style={styles.btnSubDark} numberOfLines={1}>Upload & manage documents</Text>
                </View>
                <View style={styles.chevWrapGhost}>
                  <Ionicons name="arrow-forward" size={20} color="#CBD5E1" />
                </View>
              </View>
            </PressableScale>
          </Animated.View>

          <View style={styles.footer}>
            <Ionicons name="lock-closed" size={11} color="#64748B" />
            <Text style={styles.footerText}>Encrypted · End-to-end controlled</Text>
          </View>
        </View>
      </SafeAreaView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, overflow: "hidden" },
  bootWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  orbBlue: {
    position: "absolute",
    top: -80,
    left: -60,
    width: 320,
    height: 320,
    opacity: 0.55,
  },
  orbViolet: {
    position: "absolute",
    bottom: 80,
    right: -120,
    width: 360,
    height: 360,
    opacity: 0.45,
  },
  orbInner: { width: "100%", height: "100%", borderRadius: 200 },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    borderTopWidth: 0,
  },
  safe: { flex: 1, justifyContent: "space-between" },
  header: { paddingHorizontal: 28, paddingTop: 36 },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  brand: {
    fontSize: 44,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1.4,
  },
  tagline: {
    fontSize: 15,
    color: "#CBD5E1",
    marginTop: 10,
    lineHeight: 22,
  },
  featureRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginRight: 6,
  },
  featureText: { color: "#E0E7FF", fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },

  bottom: { paddingHorizontal: 24, paddingBottom: 30, gap: 14 },
  chooseText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    padding: 16,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 14,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  btnIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  btnIconDarkWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  btnTextWrap: { flex: 1, minWidth: 0, marginRight: 8 },
  btnTitle: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  btnSub: { color: "#E0E7FF", fontSize: 12, marginTop: 2 },
  btnTitleDark: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  btnSubDark: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  chevWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  chevWrapGhost: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    opacity: 0.7,
  },
  footerText: { color: "#94A3B8", fontSize: 11, fontWeight: "500" },
});
