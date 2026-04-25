import React from "react";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../../src/theme";
import { useAuth } from "../../../src/auth";

function AdminHeader() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Admin Console</Text>
          <Text style={styles.sub}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={onLogout} testID="btn-admin-logout" style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function AdminTabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 64,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="upload"
          options={{
            title: "Upload",
            tabBarIcon: ({ color, size }) => <Ionicons name="cloud-upload-outline" size={size} color={color} />,
            tabBarTestID: "tab-admin-upload",
          }}
        />
        <Tabs.Screen
          name="manage"
          options={{
            title: "Manage",
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
            tabBarTestID: "tab-admin-manage",
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    gap: 6,
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
});
