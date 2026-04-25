import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, gradients } from "../../src/theme";
import { useAuth } from "../../src/auth";
import { setLastRole } from "../../src/api";
import PressableScale from "../../src/PressableScale";
import GradientButton from "../../src/GradientButton";

export default function AdminLogin() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [pwdFocus, setPwdFocus] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/admin/(tabs)/upload");
    }
  }, [user]);

  const onSubmit = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      await setLastRole("admin");
      router.replace("/admin/(tabs)/upload");
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Login failed";
      Alert.alert("Login failed", typeof msg === "string" ? msg : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Decorative gradient hero */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <LinearGradient
          colors={["rgba(139,92,246,0.45)", "rgba(59,130,246,0)"]}
          style={styles.heroOrb}
        />
      </LinearGradient>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.headerRow}>
              <PressableScale
                onPress={() => router.replace("/")}
                testID="btn-back-landing"
                haptic="light"
              >
                <View style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </View>
              </PressableScale>
              <Text style={styles.headerTitle}>Admin</Text>
              <View style={{ width: 40 }} />
            </View>

            <Animated.View style={[styles.body, { opacity: fade }]}>
              <LinearGradient
                colors={["#3B82F6", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconLogo}
              >
                <Ionicons name="shield-checkmark" size={30} color="#fff" />
              </LinearGradient>

              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to manage your documents</Text>

              <View style={styles.card}>
                <Text style={styles.label}>Email</Text>
                <View
                  style={[
                    styles.inputWrap,
                    emailFocus && styles.inputWrapFocus,
                  ]}
                >
                  <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="admin@example.com"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    onFocus={() => setEmailFocus(true)}
                    onBlur={() => setEmailFocus(false)}
                    returnKeyType="next"
                    testID="input-email"
                  />
                </View>

                <Text style={[styles.label, { marginTop: 18 }]}>Password</Text>
                <View
                  style={[
                    styles.inputWrap,
                    pwdFocus && styles.inputWrapFocus,
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPwd}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    onFocus={() => setPwdFocus(true)}
                    onBlur={() => setPwdFocus(false)}
                    returnKeyType="go"
                    onSubmitEditing={onSubmit}
                    testID="input-password"
                  />
                  <TouchableWithoutFeedback onPress={() => setShowPwd((s) => !s)}>
                    <View style={styles.eyeBtn}>
                      <Ionicons
                        name={showPwd ? "eye-off" : "eye"}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </View>
                  </TouchableWithoutFeedback>
                </View>

                <View style={{ height: 24 }} />

                <GradientButton
                  title="Sign In"
                  onPress={onSubmit}
                  loading={loading}
                  size="lg"
                  icon="arrow-forward"
                  testID="btn-login-submit"
                />

                <View style={styles.hint}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.hintText}>Demo: admin@example.com / admin123</Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  heroOrb: {
    position: "absolute",
    top: -40,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: 200,
  },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  iconLogo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: "#CBD5E1",
    marginTop: 6,
    marginBottom: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 22,
    ...shadow.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputWrapFocus: {
    borderColor: colors.accent,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  eyeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  hintText: { fontSize: 12, color: colors.textMuted },
});
