import React from "react";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../src/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import PressableScale from "../../src/PressableScale";

function ClientHeader() {
  const router = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.replace("/")} haptic="light" testID="btn-home">
          <View style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </View>
        </PressableScale>

        <View style={styles.brandWrap}>
          <LinearGradient
            colors={["#3B82F6", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandIcon}
          >
            <Ionicons name="document-text" size={14} color="#fff" />
          </LinearGradient>
          <Text style={styles.headerTitle}>DocVault</Text>
        </View>

        <PressableScale
          onPress={() => router.push("/admin/login")}
          haptic="light"
          testID="btn-admin-shortcut"
        >
          <View style={styles.iconBtn}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
          </View>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

export default function ClientLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ClientHeader />
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
          name="monthly"
          options={{
            title: "Monthly",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} size={22} color={color} />
            ),
            tabBarTestID: "tab-monthly-return",
          }}
        />
        <Tabs.Screen
          name="forwarding"
          options={{
            title: "Forwarding",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "paper-plane" : "paper-plane-outline"} size={22} color={color} />
            ),
            tabBarTestID: "tab-forwarding-letter",
          }}
        />
        <Tabs.Screen
          name="ifa"
          options={{
            title: "IFA",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "podium" : "podium-outline"} size={22} color={color} />
            ),
            tabBarTestID: "tab-ifa-report",
          }}
        />
        <Tabs.Screen
          name="others"
          options={{
            title: "Others",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "folder" : "folder-outline"} size={22} color={color} />
            ),
            tabBarTestID: "tab-others",
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
