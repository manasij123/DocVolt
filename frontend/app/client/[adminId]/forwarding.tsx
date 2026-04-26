import CategoryView from "../../../src/CategoryView";
import { useLocalSearchParams } from "expo-router";
export default function ForwardingTab() {
  const { adminId } = useLocalSearchParams<{ adminId: string }>();
  return <CategoryView category="FORWARDING_LETTER" adminId={adminId} />;
}
