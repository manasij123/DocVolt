import React, { useEffect, useState } from "react";
import { Stack, useRouter, useLocalSearchParams, useGlobalSearchParams } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { ConnectedAdmin, initials, colorFromString } from "../../../src/api";
import { colors } from "../../../src/theme";
import MobileDrawer, { DrawerItem } from "../../../src/MobileDrawer";
import { SelectionProvider } from "../../../src/Selection";

function Header({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const localP = useLocalSearchParams<{ adminId: string }>();
  const globalP = useGlobalSearchParams<{ adminId: string }>();
  const rawId = (localP.adminId ?? globalP.adminId) as string | string[] | undefined;
  const adminId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [admin, setAdmin] = useState<ConnectedAdmin | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!adminId) return;
    api.get<ConnectedAdmin[]>("/admins/connected").then((r) => {
      setAdmin(r.data.find((a) => a.id === adminId) || null);
    }).catch(() => {});
  }, [adminId]);

  return (
    <View style={[st.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={st.row}>
        <TouchableOpacity onPress={onMenu} style={st.menuBtn} hitSlop={8}>
          <View style={st.hamLine} />
          <View style={[st.hamLine, { width: 16 }]} />
          <View style={st.hamLine} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={[st.avatar, { backgroundColor: admin ? colorFromString(admin.id) : colors.primary }]}>
          <Text style={st.avatarText}>{admin ? initials(admin.name) : "?"}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>{admin?.name || "Loading…"}</Text>
          <Text style={st.email} numberOfLines={1}>Admin · {admin?.email}</Text>
        </View>
        {!admin && <ActivityIndicator color={colors.primary} />}
      </View>
    </View>
  );
}

export default function PerAdminLayout() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items: DrawerItem[] = [
    {
      key: "back",
      label: "← All Admins",
      icon: <Ionicons name="arrow-back-outline" size={20} color={colors.primary} />,
      onPress: () => router.replace("/client"),
    },
    {
      key: "docs",
      label: "Documents",
      icon: <Ionicons name="document-text-outline" size={20} color={colors.primary} />,
      onPress: () => {},
    },
  ];

  return (
    <SelectionProvider>
      <View style={{ flex: 1, backgroundColor: "#F7F8FC" }}>
        <Header onMenu={() => setOpen(true)} />
        <Stack screenOptions={{ headerShown: false }} />
        <MobileDrawer
          open={open}
          onClose={() => setOpen(false)}
          title="Client Console"
          items={items}
        />
      </View>
    </SelectionProvider>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EDEEF2" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 8 },
  menuBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center", gap: 3,
  },
  hamLine: { width: 18, height: 2, borderRadius: 2, backgroundColor: "#0F172A" },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9",
    borderWidth: 1, borderColor: "#EDEEF2",
    alignItems: "center", justifyContent: "center",
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  email: { color: "#64748B", fontSize: 12, marginTop: 1 },
});
