import { Stack } from "expo-router";
export default function ClientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="index" />
      <Stack.Screen name="[adminId]" />
    </Stack>
  );
}
