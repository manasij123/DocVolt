import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api, { UserInfo, initials, colorFromString } from "./api";
import { colors, radius, shadow } from "./theme";

export default function ConnectModal({
  visible,
  peerRole,
  onClose,
  onConnected,
}: {
  visible: boolean;
  peerRole: "admin" | "client";
  onClose: () => void;
  onConnected: (peer: UserInfo) => void;
}) {
  const [email, setEmail] = useState("");
  const [peer, setPeer] = useState<UserInfo | null>(null);
  const [looking, setLooking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) { setEmail(""); setPeer(null); setErr(null); return; }
  }, [visible]);

  useEffect(() => {
    setPeer(null); setErr(null);
    if (!email.trim() || !email.includes("@")) return;
    const t = setTimeout(async () => {
      setLooking(true);
      try {
        const r = await api.get("/users/lookup", { params: { email: email.trim(), role: peerRole } });
        setPeer(r.data);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Not found");
      } finally { setLooking(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [email, peerRole]);

  const connect = async () => {
    if (!peer) return;
    setConnecting(true); setErr(null);
    try {
      await api.post("/connections", { peer_email: peer.email });
      onConnected(peer);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to connect");
    } finally { setConnecting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={st.back}>
        <View style={st.card}>
          <Text style={st.title}>Connect with {peerRole === "admin" ? "an admin" : "a client"}</Text>
          <Text style={st.sub}>{peerRole === "admin"
            ? "Enter the email your admin gave you. You can connect with multiple admins."
            : "Enter the client's email. They must have registered first."}</Text>

          <Text style={st.label}>{peerRole === "admin" ? "Admin email" : "Client email"}</Text>
          <View style={st.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#5F6368" />
            <TextInput
              autoFocus
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder={peerRole === "admin" ? "admin@org.com" : "client@example.com"}
              placeholderTextColor="#9AA0A6"
              style={st.input}
            />
          </View>

          {looking && <View style={st.row}><ActivityIndicator size="small" color={colors.primary} /><Text style={st.sub}>  Looking up…</Text></View>}

          {peer && (
            <View style={st.peer}>
              <View style={[st.avatar, { backgroundColor: colorFromString(peer.id) }]}>
                <Text style={st.avatarText}>{initials(peer.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.peerName}>{peer.name}</Text>
                <Text style={st.peerEmail}>{peer.role === "admin" ? "Admin · " : "Client · "}{peer.email}</Text>
              </View>
              <View style={st.tag}><Text style={st.tagText}>{peer.role.toUpperCase()}</Text></View>
            </View>
          )}

          {err && !looking && <View style={st.errBox}><Ionicons name="alert-circle" size={16} color="#B00020" /><Text style={st.errText}>{err}</Text></View>}

          <View style={st.actions}>
            <TouchableOpacity onPress={onClose} style={[st.btn, st.btnGhost]} disabled={connecting}>
              <Text style={st.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={connect} style={[st.btn, st.btnPrimary, !peer && st.btnDisabled]} disabled={!peer || connecting}>
              {connecting ? <ActivityIndicator color="#fff" /> : <Text style={st.btnPrimaryText}>🔗  Connect</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(32,33,36,0.55)", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: radius.xl, padding: 24, width: "100%", maxWidth: 460, ...shadow.lg },
  title: { fontSize: 18, fontWeight: "800", color: "#202124", marginBottom: 4 },
  sub: { fontSize: 13, color: "#5F6368", marginBottom: 14, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: "#5F6368", textTransform: "uppercase", marginTop: 6, marginBottom: 6 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#DADCE0", borderRadius: radius.md, backgroundColor: "#F8F9FA" },
  input: { flex: 1, fontSize: 15, color: "#202124" },
  row: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  peer: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, padding: 12, backgroundColor: "#E8F0FE", borderRadius: radius.md, borderWidth: 1, borderColor: "#BBDBFB" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  peerName: { fontSize: 15, fontWeight: "800", color: "#202124" },
  peerEmail: { fontSize: 12.5, color: "#5F6368", marginTop: 2 },
  tag: { backgroundColor: "#1A73E8", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  tagText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 10, backgroundColor: "#FCE8E6", borderRadius: radius.md, borderWidth: 1, borderColor: "#FCA5A5" },
  errText: { color: "#B00020", fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  btn: { flex: 1, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DADCE0" },
  btnGhostText: { color: "#202124", fontWeight: "700", fontSize: 14 },
  btnPrimary: { backgroundColor: "#1A73E8" },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
