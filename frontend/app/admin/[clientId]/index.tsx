import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Default landing for /admin/[clientId]/ — redirects to the "Manage"
 * tab. Without this file Expo Router has no route at
 * /admin/:clientId/ (only children like /upload, /manage, /categories)
 * which caused a native-level crash when an admin tapped on a client
 * card on Android/iOS (the router failed to resolve a screen).
 *
 * The explicit `<Redirect />` makes the first screen deterministic on
 * both web and native builds.
 */
export default function PerClientIndex() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  return <Redirect href={`/admin/${clientId}/manage` as const} />;
}
