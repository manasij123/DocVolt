import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth";
import SecurityBackground from "../src/SecurityBackground";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              animationDuration: 280,
              gestureEnabled: true,
              contentStyle: { backgroundColor: "#F2F2F2" },
            }}
          >
            <Stack.Screen name="index" options={{ animation: "fade" }} />
            <Stack.Screen name="admin" />
            <Stack.Screen name="client" options={{ animation: "slide_from_bottom" }} />
          </Stack>
          {/* Global decorative background — rendered ABOVE screens with
              pointerEvents="none" so it never blocks taps. Opacity is kept
              very low inside the component so it acts as ambient texture. */}
          <SecurityBackground />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
