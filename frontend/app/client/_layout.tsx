import React from "react";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { SafeAreaView } from "react-native-safe-area-context";

function ClientHeader() {
  const router = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/")} testID="btn-home">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
        <TouchableOpacity onPress={() => router.push("/admin/login")} testID="btn-admin-shortcut">
          <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function ClientLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ClientHeader />
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
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="monthly"
          options={{
            title: "Monthly",
            tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
            tabBarTestID: "tab-monthly-return",
          }}
        />
        <Tabs.Screen
          name="forwarding"
          options={{
            title: "Forwarding",
            tabBarIcon: ({ color, size }) => <Ionicons name="attach-outline" size={size} color={color} />,
            tabBarTestID: "tab-forwarding-letter",
          }}
        />
        <Tabs.Screen
          name="ifa"
          options={{
            title: "IFA",
            tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
            tabBarTestID: "tab-ifa-report",
          }}
        />
        <Tabs.Screen
          name="others"
          options={{
            title: "Others",
            tabBarIcon: ({ color, size }) => <Ionicons name="folder-outline" size={size} color={color} />,
            tabBarTestID: "tab-others",
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
