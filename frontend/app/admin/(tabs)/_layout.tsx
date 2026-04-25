import React from "react";
import { Tabs, useRouter } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, gradients } from "../../../src/theme";
import { useAuth } from "../../../src/auth";
import PressableScale from "../../../src/PressableScale";

function AdminHeader() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <View style={{ backgroundColor: colors.primary }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(139,92,246,0.30)", "rgba(11,18,32,0)"]}
        style={styles.glow}
      />
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <LinearGradient
              colors={["#3B82F6", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.brandIcon}
            >
              <Ionicons name="shield-checkmark" size={16} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.brand}>Admin Console</Text>
              <Text style={styles.sub}>{user?.email}</Text>
            </View>
          </View>

          <PressableScale onPress={onLogout} haptic="medium" testID="btn-admin-logout">
            <View style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={16} color="#FCA5A5" />
              <Text style={styles.logoutText}>Logout</Text>
            </View>
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function AdminTabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AdminHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 70,
            paddingTop: 8,
            paddingBottom: 10,
            shadowColor: "#0B1220",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 12,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
        }}
      >
        <Tabs.Screen
          name="upload"
          options={{
            title: "Upload",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "cloud-upload" : "cloud-upload-outline"}
                size={22}
                color={color}
              />
            ),
            tabBarTestID: "tab-admin-upload",
          }}
        />
        <Tabs.Screen
          name="manage"
          options={{
            title: "Manage",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "settings" : "settings-outline"}
                size={22}
                color={color}
              />
            ),
            tabBarTestID: "tab-admin-manage",
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    top: -40,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 200,
  },
  header: {
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  brand: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.2,
  },
  sub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    gap: 6,
  },
  logoutText: { color: "#FCA5A5", fontWeight: "700", fontSize: 12 },
});
