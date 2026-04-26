import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
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
      </AuthProvider>
    </SafeAreaProvider>
  );
}
