import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api, { ConnectedAdmin, initials, colorFromString } from "../../src/api";
import { useAuth } from "../../src/auth";
import { useDocsSocket } from "../../src/useDocsSocket";
import { useToast } from "../../src/Toast";
import ConnectModal from "../../src/ConnectModal";
import { FadeInItem } from "../../src/AnimatedList";
import { colors, gradients, radius, shadow } from "../../src/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Ic } from "../../src/Icons";
import MobileDrawer, { DrawerHeader, DrawerItem } from "../../src/MobileDrawer";

export default function ClientHome() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const toast = useToast();
  const [admins, setAdmins] = useState<ConnectedAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const removeConnection = (a: ConnectedAdmin) => {
    Alert.alert(
      "Remove connection",
      `Disconnect from ${a.name}?\n\nYou will no longer see their workspace. Existing documents are not deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setAdmins((prev) => prev.filter((x) => x.id !== a.id));
            try {
              await api.delete(`/connections/${a.id}`);
              toast.show(`Disconnected from ${a.name}`, { kind: "success", icon: "checkmark-circle" });
            } catch (e: any) {
              await reload();
              toast.show(e?.response?.data?.detail || "Failed to disconnect", { kind: "error" });
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "client") router.replace("/client/login");
  }, [authLoading, user]);

  const reload = async () => {
    try {
      const r = await api.get<ConnectedAdmin[]>("/admins/connected");
      setAdmins(r.data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { reload(); }, []);

  useDocsSocket((e) => {
    if (e.type === "connection:created" || e.type === "connection:removed" ||
        e.type === "doc:created" || e.type === "doc:deleted" || e.type === "doc:updated") {
      reload();
    }
  });

  const onLogout = () => {
    Alert.alert("Logout", "Sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/"); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FC" }}>
      <DrawerHeader title="DocVault" onMenu={() => setDrawerOpen(true)} />

      <FlatList
        data={admins}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); reload(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.h1}>Hello, {user?.name?.split(" ")[0] || "there"}!</Text>
                <Text style={st.subtitle}>{admins.length === 0 ? "Tap '+ Connect' to add an admin." : `Connected with ${admins.length} admin${admins.length === 1 ? "" : "s"}.`}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConnect(true)} style={st.addBtn}>
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.addBtnGrad}>
                  <Ionicons name="link" size={18} color="#fff" />
                  <Text style={st.addBtnText}>Connect</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item: a, index }) => (
          <FadeInItem index={index}>
            <TouchableOpacity onPress={() => router.push(`/client/${a.id}`)} onLongPress={() => removeConnection(a)} delayLongPress={400} activeOpacity={0.85} style={st.row}>
              <View style={[st.avatar, { backgroundColor: colorFromString(a.id) }]}>
                <Text style={st.avatarText}>{initials(a.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.name} numberOfLines={1}>{a.name}</Text>
                <Text style={st.email} numberOfLines={1}>Admin · {a.email}</Text>
              </View>
              <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                <Text style={st.statNum}>{a.doc_count}</Text>
                <Text style={st.statLbl}>{a.doc_count === 1 ? "FILE" : "FILES"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#80868B" />
            </TouchableOpacity>
          </FadeInItem>
        )}
        ListEmptyComponent={loading ? (
          <View style={st.empty}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <View style={st.empty}>
            <Ionicons name="link-outline" size={48} color="#80868B" />
            <Text style={st.emptyTitle}>Connect with your first admin</Text>
            <Text style={st.emptyText}>Ask your admin for their email, then tap "+ Connect" to link up.</Text>
          </View>
        )}
      />

      <ConnectModal visible={showConnect} peerRole="admin" onClose={() => setShowConnect(false)}
        onConnected={() => { setShowConnect(false); reload(); }} />

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Client Console"
        subtitle={user?.email}
        items={[
          {
            key: "admins",
            label: "My Admins",
            badge: admins.length || undefined,
            icon: <Ionicons name="people-outline" size={20} color="#3801FF" />,
            onPress: () => {},
          },
          {
            key: "connect",
            label: "Connect with Admin",
            icon: <Ionicons name="link-outline" size={20} color="#3801FF" />,
            onPress: () => setShowConnect(true),
          },
        ]}
      />
    </View>
  );
}

const st = StyleSheet.create({
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8EAED" },
  headerInner: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  brand: { color: "#202124", fontSize: 18, fontWeight: "800" },
  who: { color: "#5F6368", fontSize: 12, marginTop: 2 },
  logoutBtn: { padding: 8, borderRadius: radius.md, backgroundColor: "#F4F6FB", borderWidth: 1, borderColor: "#E8EAED" },
  h1: { fontSize: 24, fontWeight: "800", color: "#202124", letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: "#5F6368", marginTop: 2 },
  addBtn: { borderRadius: radius.md, overflow: "hidden" },
  addBtnGrad: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
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
