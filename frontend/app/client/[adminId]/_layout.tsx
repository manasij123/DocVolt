import React, { useEffect, useState } from "react";
import { Tabs, useRouter, useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api, { ConnectedAdmin, initials, colorFromString } from "../../../src/api";
import { colors, radius } from "../../../src/theme";

function Header() {
  const router = useRouter();
  const { adminId } = useLocalSearchParams<{ adminId: string }>();
  const [admin, setAdmin] = useState<ConnectedAdmin | null>(null);

  useEffect(() => {
    if (!adminId) return;
    api.get<ConnectedAdmin[]>("/admins/connected").then((r) => {
      setAdmin(r.data.find((a) => a.id === adminId) || null);
    }).catch(() => {});
  }, [adminId]);

  return (
    <View style={st.wrap}>
      <SafeAreaView edges={["top"]}>
        <View style={st.row}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={[st.avatar, { backgroundColor: admin ? colorFromString(admin.id) : "#1A73E8" }]}>
            <Text style={st.avatarText}>{admin ? initials(admin.name) : "?"}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.name} numberOfLines={1}>{admin?.name || "Loading…"}</Text>
            <Text style={st.email} numberOfLines={2}>Admin · {admin?.email}</Text>
          </View>
          {!admin && <ActivityIndicator color={colors.primary} />}
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function PerAdminLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 70, paddingTop: 8, paddingBottom: 10 },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        }}
      >
        <Tabs.Screen name="monthly" options={{ title: "Monthly", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={20} color={color} /> }} />
        <Tabs.Screen name="forwarding" options={{ title: "Forwarding", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "mail" : "mail-outline"} size={20} color={color} /> }} />
        <Tabs.Screen name="ifa" options={{ title: "IFA", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "trending-up" : "trending-up-outline"} size={20} color={color} /> }} />
        <Tabs.Screen name="others" options={{ title: "Others", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "folder" : "folder-outline"} size={20} color={color} /> }} />
      </Tabs>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8EAED" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F4F6FB", borderWidth: 1, borderColor: "#E8EAED", alignItems: "center", justifyContent: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  name: { color: "#202124", fontSize: 15, fontWeight: "800" },
  email: { color: "#5F6368", fontSize: 12, marginTop: 1 },
});
