import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api, { ClientRow, initials, colorFromString } from "../../src/api";
import { useAuth } from "../../src/auth";
import { useDocsSocket } from "../../src/useDocsSocket";
import { useToast } from "../../src/Toast";
import ConnectModal from "../../src/ConnectModal";
import { FadeInItem } from "../../src/AnimatedList";
import { colors, gradients, radius, shadow } from "../../src/theme";
import { Ic } from "../../src/Icons";

export default function AdminHome() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const toast = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  const removeConnection = (c: ClientRow) => {
    Alert.alert(
      "Remove connection",
      `Remove connection with ${c.name}?\n\nThe client will no longer appear in your workspace. Existing documents are not deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // Optimistic update
            setClients((prev) => prev.filter((x) => x.id !== c.id));
            try {
              await api.delete(`/connections/${c.id}`);
              toast.show(`Removed ${c.name}`, { kind: "success", icon: "checkmark-circle" });
            } catch (e: any) {
              // Roll back if API failed
              await reload();
              toast.show(e?.response?.data?.detail || "Failed to remove connection", { kind: "error" });
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "admin") {
      router.replace("/admin/login");
    }
  }, [authLoading, user]);

  const reload = async () => {
    try {
      const r = await api.get<ClientRow[]>("/clients");
      setClients(r.data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { reload(); }, []);

  useDocsSocket((e) => {
    if (e.type === "connection:created" || e.type === "connection:removed" ||
        e.type === "doc:created" || e.type === "doc:deleted" || e.type === "doc:updated") {
      reload();
    } else if (e.type === "client:registered") {
      // toast-ish — user can connect from modal
    }
  });

  const onLogout = () => {
    Alert.alert("Logout", "Sign out of admin console?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/"); } },
    ]);
  };

  const totalDocs = clients.reduce((s, c) => s + (c.doc_count || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F6FB" }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.header}>
        <SafeAreaView edges={["top"]}>
          <View style={st.headerInner}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.brand}>Admin Console</Text>
              <Text style={st.who} numberOfLines={1}>{user?.email}</Text>
            </View>
            <TouchableOpacity onPress={onLogout} style={st.logoutBtn}>
              <Ic kind="logout" size={18} />
              <Text style={st.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={clients}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); reload(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.h1}>Your clients</Text>
                <Text style={st.subtitle}>{clients.length} connected · {totalDocs} files</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConnect(true)} style={st.addBtn}>
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.addBtnGrad}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={st.addBtnText}>Add Client</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <Text style={st.shareHint}>Share <Text style={st.kbd}>{user?.email}</Text> with new clients to auto-connect at register.</Text>
          </View>
        }
        renderItem={({ item: c, index }) => (
          <FadeInItem index={index}>
            <TouchableOpacity onPress={() => router.push(`/admin/${c.id}`)} onLongPress={() => removeConnection(c)} delayLongPress={400} activeOpacity={0.85} style={st.row}>
              <View style={[st.avatar, { backgroundColor: colorFromString(c.id) }]}>
                <Text style={st.avatarText}>{initials(c.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.name} numberOfLines={1}>{c.name}</Text>
                <Text style={st.email} numberOfLines={1}>{c.email}</Text>
              </View>
              <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                <Text style={st.statNum}>{c.doc_count}</Text>
                <Text style={st.statLbl}>{c.doc_count === 1 ? "FILE" : "FILES"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#80868B" />
            </TouchableOpacity>
          </FadeInItem>
        )}
        ListEmptyComponent={loading ? (
          <View style={st.empty}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <View style={st.empty}>
            <Ionicons name="people-outline" size={48} color="#80868B" />
            <Text style={st.emptyTitle}>No clients yet</Text>
            <Text style={st.emptyText}>Tap "Add Client" to invite an already-registered client, or share your email so new clients auto-connect.</Text>
          </View>
        )}
      />

      <ConnectModal visible={showConnect} peerRole="client" onClose={() => setShowConnect(false)}
        onConnected={() => { setShowConnect(false); reload(); }} />
    </View>
  );
}

const st = StyleSheet.create({
  header: { paddingBottom: 16 },
  headerInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  brand: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  who: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: radius.md },
  logoutText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  h1: { fontSize: 24, fontWeight: "800", color: "#202124", letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: "#5F6368", marginTop: 2 },
  addBtn: { borderRadius: radius.md, overflow: "hidden" },
  addBtnGrad: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  shareHint: { fontSize: 12, color: "#5F6368", marginTop: 12, lineHeight: 17 },
  kbd: { fontFamily: "monospace", color: "#1A73E8", backgroundColor: "#E8F0FE", paddingHorizontal: 4, borderRadius: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 10, backgroundColor: "#fff", borderRadius: radius.lg, borderWidth: 1, borderColor: "#E8EAED", ...shadow.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { fontSize: 15, fontWeight: "800", color: "#202124" },
  email: { fontSize: 12.5, color: "#5F6368", marginTop: 2 },
  statNum: { fontSize: 18, fontWeight: "800", color: colors.primary, lineHeight: 20 },
  statLbl: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6, color: "#5F6368", marginTop: 2 },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#202124", marginTop: 6 },
  emptyText: { textAlign: "center", fontSize: 13, color: "#5F6368", lineHeight: 19, paddingHorizontal: 20 },
});
