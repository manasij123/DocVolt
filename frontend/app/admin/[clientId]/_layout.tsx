import React, { useEffect, useState } from "react";
import { Tabs, useRouter, useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import api, { ClientRow, initials, colorFromString } from "../../../src/api";
import { colors, gradients, radius } from "../../../src/theme";

function Header() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [client, setClient] = useState<ClientRow | null>(null);

  useEffect(() => {
    if (!clientId) return;
    api.get<ClientRow[]>("/clients").then((r) => {
      setClient(r.data.find((c) => c.id === clientId) || null);
    }).catch(() => {});
  }, [clientId]);

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView edges={["top"]}>
        <View style={st.row}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={[st.avatar, { backgroundColor: client ? colorFromString(client.id) : "#1A73E8" }]}>
            <Text style={st.avatarText}>{client ? initials(client.name) : "?"}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.name} numberOfLines={1}>{client?.name || "Loading…"}</Text>
            <Text style={st.email} numberOfLines={2}>{client?.email}</Text>
          </View>
          {!client && <ActivityIndicator color="#fff" />}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function PerClientLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 70, paddingTop: 8, paddingBottom: 10 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        }}
      >
        <Tabs.Screen name="upload" options={{ title: "Upload", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "cloud-upload" : "cloud-upload-outline"} size={22} color={color} /> }} />
        <Tabs.Screen name="manage" options={{ title: "Manage", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} /> }} />
        <Tabs.Screen name="categories" options={{ title: "Tabs", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "pricetags" : "pricetags-outline"} size={22} color={color} /> }} />
        <Tabs.Screen name="bulk-upload" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  name: { color: "#fff", fontSize: 15, fontWeight: "800" },
  email: { color: "#CBD5E1", fontSize: 12, marginTop: 1 },
});
