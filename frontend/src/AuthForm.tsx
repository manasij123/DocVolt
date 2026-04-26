import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius } from "./theme";
import { useAuth, AUTH_WRONG_ROLE } from "./auth";

type Mode = "login" | "register";
type Role = "admin" | "client";

export default function AuthForm({ mode, role, defaultEmail = "" }: { mode: Mode; role: Role; defaultEmail?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // If login succeeds with the *other* role, expose a quick link to switch.
  const [wrongRole, setWrongRole] = useState<null | "admin" | "client">(null);
  // Refs for keyboard-aware scrolling
  const scrollRef = useRef<ScrollView>(null);
  const fieldYs = useRef<Record<string, number>>({});
  const cardOffsetY = useRef(0);
  const handleInputFocus = (key: string) => {
    const yPos = (cardOffsetY.current || 0) + (fieldYs.current[key] ?? 0);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, yPos - 60), animated: true });
    }, Platform.OS === "ios" ? 50 : 280);
  };

  const submit = async () => {
    setErr(null);
    setWrongRole(null);
    try {
      if (mode === "login") {
        if (!email.trim() || !password) { setErr("Email and password required"); return; }
        setLoading(true);
        const u = await login(email.trim(), password, role);
        router.replace(role === "admin" ? "/admin" : "/client");
        // unreachable when login throws AUTH_WRONG_ROLE
        void u;
      } else {
        if (!name.trim()) { setErr("Name is required"); return; }
        if (password.length < 6) { setErr("Password must be at least 6 characters"); return; }
        if (password !== confirm) { setErr("Passwords do not match"); return; }
        setLoading(true);
        await register(email.trim(), password, name.trim(), role, role === "client" ? adminEmail.trim() || undefined : undefined);
        router.replace(role === "admin" ? "/admin" : "/client");
      }
    } catch (e: any) {
      if (e?.code === AUTH_WRONG_ROLE || e?.message === AUTH_WRONG_ROLE) {
        const actual = (e?.actualRole as "admin" | "client" | undefined) || (role === "admin" ? "client" : "admin");
        setWrongRole(actual);
        setErr(
          actual === "admin"
            ? "This is an Admin account. Please use the Admin login screen."
            : "This is a Client account. Please use the Client login screen."
        );
      } else {
        setErr(e?.response?.data?.detail || e?.message || (mode === "login" ? "Login failed" : "Registration failed"));
      }
    } finally { setLoading(false); }
  };

  const isClient = role === "client";
  const heroIcon = role === "admin" ? (mode === "register" ? "rocket" : "shield-checkmark") : (mode === "register" ? "sparkles" : "people");
  const heroTitle = mode === "login"
    ? (isClient ? "Client Login" : "Admin Login")
    : (isClient ? "Create your account" : "Become an Admin");
  const heroSub = mode === "login"
    ? (isClient ? "Welcome back — sign in to view your documents" : "Sign in to manage documents per client")
    : (isClient ? "Free — takes 30 seconds. Auto-connect with your admin." : "Create your admin workspace — invite clients with your email.");

  return (
    <View style={st.root}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: 24, paddingBottom: 80 + insets.bottom, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Back</Text>
            </TouchableOpacity>

            <View style={{ alignItems: "center", marginVertical: 16 }}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.iconWrap}>
                <Ionicons name={heroIcon as any} size={26} color="#fff" />
              </LinearGradient>
              <Text style={st.title}>{heroTitle}</Text>
              <Text style={st.sub}>{heroSub}</Text>
            </View>

            <View style={st.card} onLayout={(e) => { cardOffsetY.current = e.nativeEvent.layout.y; }}>
              {err && (
                <View style={st.errBox}>
                  <Ionicons name="alert-circle" size={16} color="#B00020" />
                  <View style={{ flex: 1 }}>
                    <Text style={st.errText}>{err}</Text>
                    {wrongRole && (
                      <TouchableOpacity
                        onPress={() => {
                          const target = wrongRole === "admin" ? "/admin/login" : "/client/login";
                          router.replace(target);
                        }}
                        style={st.switchBtn}
                      >
                        <Ionicons name={wrongRole === "admin" ? "shield-checkmark" : "people"} size={14} color="#1A73E8" />
                        <Text style={st.switchBtnText}>
                          Go to {wrongRole === "admin" ? "Admin" : "Client"} Login
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color="#1A73E8" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {mode === "register" && (
                <Field label="Full name" icon="person-outline" onLayoutY={(y: number) => { fieldYs.current["name"] = y; }}>
                  <TextInput value={name} onChangeText={setName} onFocus={() => handleInputFocus("name")} placeholder={isClient ? "Your name" : "Your name or org"} placeholderTextColor="#9AA0A6" style={st.input} />
                </Field>
              )}
              <Field label={role === "admin" && mode === "register" ? "Email (clients will use this to connect)" : "Email"} icon="mail-outline" onLayoutY={(y: number) => { fieldYs.current["email"] = y; }}>
                <TextInput value={email} onChangeText={setEmail} onFocus={() => handleInputFocus("email")} placeholder={role === "admin" ? "admin@org.com" : "you@example.com"} placeholderTextColor="#9AA0A6" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={st.input} />
              </Field>
              <Field label="Password" icon="lock-closed-outline" onLayoutY={(y: number) => { fieldYs.current["password"] = y; }}>
                <TextInput value={password} onChangeText={setPassword} onFocus={() => handleInputFocus("password")} placeholder={mode === "register" ? "At least 6 characters" : "••••••••"} placeholderTextColor="#9AA0A6" secureTextEntry={!showPwd} style={st.input} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                <TouchableOpacity onPress={() => setShowPwd((s) => !s)} style={st.eyeBtn}>
                  <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color="#5F6368" />
                </TouchableOpacity>
              </Field>
              {mode === "register" && (
                <Field label="Confirm password" icon="checkmark-circle-outline" onLayoutY={(y: number) => { fieldYs.current["confirm"] = y; }}>
                  <TextInput value={confirm} onChangeText={setConfirm} onFocus={() => handleInputFocus("confirm")} placeholder="Repeat password" placeholderTextColor="#9AA0A6" secureTextEntry={!showPwd} style={st.input} autoComplete="new-password" />
                </Field>
              )}
              {mode === "register" && isClient && (
                <Field label="Admin email (optional — auto-connect)" icon="shield-outline" onLayoutY={(y: number) => { fieldYs.current["adminEmail"] = y; }}>
                  <TextInput value={adminEmail} onChangeText={setAdminEmail} onFocus={() => handleInputFocus("adminEmail")} placeholder="admin@org.com (skip if you'll add later)" placeholderTextColor="#9AA0A6" autoCapitalize="none" keyboardType="email-address" style={st.input} />
                </Field>
              )}

              <TouchableOpacity onPress={submit} disabled={loading} style={[st.btn, loading && { opacity: 0.6 }]}>
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.btnGrad}>
                  {loading ? <ActivityIndicator color="#fff" /> :
                    <Text style={st.btnText}>{mode === "login" ? "Sign In →" : "Create account →"}</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <View style={st.hint}>
                {mode === "login" ? (
                  <Text style={st.hintText}>
                    No account?{" "}
                    <Link href={isClient ? "/client/register" : "/admin/register"} style={st.linkText}>Register</Link>
                  </Text>
                ) : (
                  <Text style={st.hintText}>
                    Already have an account?{" "}
                    <Link href={isClient ? "/client/login" : "/admin/login"} style={st.linkText}>Sign in</Link>
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, icon, children, onLayoutY }: any) {
  return (
    <View
      style={{ marginBottom: 14 }}
      onLayout={(e) => onLayoutY?.(e.nativeEvent.layout.y)}
    >
      <Text style={st.label}>{label}</Text>
      <View style={st.inputWrap}>
        <Ionicons name={icon} size={18} color="#5F6368" />
        {children}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  iconWrap: { width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  sub: { color: "#CBD5E1", fontSize: 13, marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 22, marginTop: 12 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.7, color: "#5F6368", textTransform: "uppercase", marginBottom: 6 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#DADCE0", borderRadius: radius.md, backgroundColor: "#F8F9FA" },
  input: { flex: 1, fontSize: 15, color: "#202124" },
  eyeBtn: { padding: 4 },
  btn: { marginTop: 6, borderRadius: radius.md, overflow: "hidden" },
  btnGrad: { height: 50, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  errBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12, padding: 10, backgroundColor: "#FCE8E6", borderRadius: radius.md, borderWidth: 1, borderColor: "#FCA5A5" },
  errText: { color: "#B00020", fontSize: 13, fontWeight: "600" },
  switchBtn: { marginTop: 8, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff", borderRadius: 999, borderWidth: 1, borderColor: "#BFDBFE" },
  switchBtnText: { color: "#1A73E8", fontSize: 12, fontWeight: "800" },
  hint: { alignItems: "center", marginTop: 14 },
  hintText: { color: "#5F6368", fontSize: 13 },
  linkText: { color: "#1A73E8", fontWeight: "800" },
});
