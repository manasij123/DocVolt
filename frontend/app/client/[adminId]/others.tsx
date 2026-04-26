import CategoryView from "../../../src/CategoryView";
import { useLocalSearchParams } from "expo-router";
export default function OthersTab() {
  const { adminId } = useLocalSearchParams<{ adminId: string }>();
  return <CategoryView category="OTHERS" adminId={adminId} />;
}
