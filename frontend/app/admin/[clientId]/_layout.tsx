import React, { useEffect, useState } from "react";
import { Tabs, useRouter, useLocalSearchParams, useGlobalSearchParams } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { ClientRow, initials, colorFromString } from "../../../src/api";
import { colors } from "../../../src/theme";
import MobileDrawer, { DrawerItem } from "../../../src/MobileDrawer";

function Header({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const localP = useLocalSearchParams<{ clientId: string }>();
  const globalP = useGlobalSearchParams<{ clientId: string }>();
  const rawId = (localP.clientId ?? globalP.clientId) as string | string[] | undefined;
  const clientId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [client, setClient] = useState<ClientRow | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!clientId) return;
    api.get<ClientRow[]>("/clients").then((r) => {
      setClient(r.data.find((c) => c.id === clientId) || null);
    }).catch(() => {});
  }, [clientId]);

  return (
    <View style={[st.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={st.row}>
        <TouchableOpacity onPress={onMenu} style={st.iconBtn} hitSlop={8}>
          <View style={st.hamLine} />
          <View style={[st.hamLine, { width: 16 }]} />
          <View style={st.hamLine} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={st.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={[st.avatar, { backgroundColor: client ? colorFromString(client.id) : colors.primary }]}>
          <Text style={st.avatarText}>{client ? initials(client.name) : "?"}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>{client?.name || "Loading…"}</Text>
          <Text style={st.email} numberOfLines={1}>{client?.email}</Text>
        </View>
        {!client && <ActivityIndicator color={colors.primary} />}
      </View>
    </View>
  );
}

export default function PerClientLayout() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items: DrawerItem[] = [
    {
      key: "back",
      label: "← All Clients",
      icon: <Ionicons name="arrow-back-outline" size={20} color={colors.primary} />,
      onPress: () => router.replace("/admin"),
    },
    {
      key: "upload",
      label: "Upload",
      icon: <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />,
      onPress: () => router.push("upload"),
    },
    {
      key: "manage",
      label: "Manage Documents",
      icon: <Ionicons name="settings-outline" size={20} color={colors.primary} />,
      onPress: () => router.push("manage"),
    },
    {
      key: "categories",
      label: "Categories",
      icon: <Ionicons name="pricetags-outline" size={20} color={colors.primary} />,
      onPress: () => router.push("categories"),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FC" }}>
      <Header onMenu={() => setOpen(true)} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: "#64748B",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopColor: "#EDEEF2",
            height: 70,
            paddingTop: 8,
            paddingBottom: 10,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        }}
      >
        <Tabs.Screen name="upload" options={{ title: "Upload", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "cloud-upload" : "cloud-upload-outline"} size={22} color={color} /> }} />
        <Tabs.Screen name="manage" options={{ title: "Manage", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} /> }} />
        <Tabs.Screen name="categories" options={{ title: "Categories", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "pricetags" : "pricetags-outline"} size={22} color={color} /> }} />
        <Tabs.Screen name="bulk-upload" options={{ href: null }} />
      </Tabs>
      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Admin Console"
        subtitle={client?.name ? `Viewing ${client.name}` : undefined}
        items={items}
      />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EDEEF2" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center", gap: 3,
    borderWidth: 1, borderColor: "#EDEEF2",
  },
  hamLine: { width: 18, height: 2, borderRadius: 2, backgroundColor: "#0F172A" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  email: { color: "#64748B", fontSize: 12, marginTop: 1 },
});
