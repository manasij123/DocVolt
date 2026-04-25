import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../src/theme";

export default function Landing() {
  const router = useRouter();

  return (
    <View style={styles.root} testID="landing-screen">
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1767300258298-21f93cbe723f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMGFic3RyYWN0JTIwdGV4dHVyZXxlbnwwfHx8fDE3NzcxNDg0NDZ8MA&ixlib=rb-4.1.0&q=85",
        }}
        style={styles.bg}
        imageStyle={styles.bgImage}
      >
        <View style={styles.overlay} />
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Ionicons name="document-text" size={26} color="#fff" />
            </View>
            <Text style={styles.brand}>DocVault</Text>
            <Text style={styles.tagline}>Organised PDF storage for your team</Text>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.chooseText}>Continue as</Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push("/client")}
              testID="btn-client-access"
              activeOpacity={0.9}
            >
              <View style={styles.btnIconWrap}>
                <Ionicons name="people" size={20} color={colors.accent} />
              </View>
              <View style={styles.btnTextWrap}>
                <Text style={styles.btnTitle}>Client</Text>
                <Text style={styles.btnSub}>Browse and share documents</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/admin/login")}
              testID="btn-admin-access"
              activeOpacity={0.9}
            >
              <View style={[styles.btnIconWrap, { backgroundColor: "#1E293B" }]}>
                <Ionicons name="shield-checkmark" size={20} color="#fff" />
              </View>
              <View style={styles.btnTextWrap}>
                <Text style={[styles.btnTitle, { color: "#fff" }]}>Admin</Text>
                <Text style={[styles.btnSub, { color: "#CBD5E1" }]}>Upload & manage documents</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  bg: { flex: 1 },
  bgImage: { resizeMode: "cover" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.82)",
  },
  safe: { flex: 1, justifyContent: "space-between" },
  header: {
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  brand: {
    fontSize: 40,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: "#CBD5E1",
    marginTop: 8,
    lineHeight: 22,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  chooseText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: 16,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  btnIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  btnTextWrap: { flex: 1 },
  btnTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  btnSub: { color: "#E0E7FF", fontSize: 13, marginTop: 2 },
});
