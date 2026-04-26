import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius } from "./theme";
import { useAuth } from "./auth";

type Mode = "login" | "register";
type Role = "admin" | "client";

export default function AuthForm({ mode, role, defaultEmail = "" }: { mode: Mode; role: Role; defaultEmail?: string }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    try {
      if (mode === "login") {
        if (!email.trim() || !password) { setErr("Email and password required"); return; }
        setLoading(true);
        const u = await login(email.trim(), password);
        if (u.role !== role) {
          setErr(`This account is a ${u.role}. Use ${u.role} login.`);
          return;
        }
        router.replace(role === "admin" ? "/admin" : "/client");
      } else {
        if (!name.trim()) { setErr("Name is required"); return; }
        if (password.length < 6) { setErr("Password must be at least 6 characters"); return; }
        if (password !== confirm) { setErr("Passwords do not match"); return; }
        setLoading(true);
        await register(email.trim(), password, name.trim(), role, role === "client" ? adminEmail.trim() || undefined : undefined);
        router.replace(role === "admin" ? "/admin" : "/client");
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || (mode === "login" ? "Login failed" : "Registration failed"));
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
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
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

            <View style={st.card}>
              {err && <View style={st.errBox}><Ionicons name="alert-circle" size={16} color="#B00020" /><Text style={st.errText}>{err}</Text></View>}

              {mode === "register" && (
                <Field label="Full name" icon="person-outline">
                  <TextInput value={name} onChangeText={setName} placeholder={isClient ? "Your name" : "Your name or org"} placeholderTextColor="#9AA0A6" style={st.input} />
                </Field>
              )}
              <Field label={role === "admin" && mode === "register" ? "Email (clients will use this to connect)" : "Email"} icon="mail-outline">
                <TextInput value={email} onChangeText={setEmail} placeholder={role === "admin" ? "admin@org.com" : "you@example.com"} placeholderTextColor="#9AA0A6" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={st.input} />
              </Field>
              <Field label="Password" icon="lock-closed-outline">
                <TextInput value={password} onChangeText={setPassword} placeholder={mode === "register" ? "At least 6 characters" : "••••••••"} placeholderTextColor="#9AA0A6" secureTextEntry={!showPwd} style={st.input} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                <TouchableOpacity onPress={() => setShowPwd((s) => !s)} style={st.eyeBtn}>
                  <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color="#5F6368" />
                </TouchableOpacity>
              </Field>
              {mode === "register" && (
                <Field label="Confirm password" icon="checkmark-circle-outline">
                  <TextInput value={confirm} onChangeText={setConfirm} placeholder="Repeat password" placeholderTextColor="#9AA0A6" secureTextEntry={!showPwd} style={st.input} autoComplete="new-password" />
                </Field>
              )}
              {mode === "register" && isClient && (
                <Field label="Admin email (optional — auto-connect)" icon="shield-outline">
                  <TextInput value={adminEmail} onChangeText={setAdminEmail} placeholder="admin@org.com (skip if you'll add later)" placeholderTextColor="#9AA0A6" autoCapitalize="none" keyboardType="email-address" style={st.input} />
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

function Field({ label, icon, children }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
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
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, padding: 10, backgroundColor: "#FCE8E6", borderRadius: radius.md, borderWidth: 1, borderColor: "#FCA5A5" },
  errText: { flex: 1, color: "#B00020", fontSize: 13, fontWeight: "600" },
  hint: { alignItems: "center", marginTop: 14 },
  hintText: { color: "#5F6368", fontSize: 13 },
  linkText: { color: "#1A73E8", fontWeight: "800" },
});
