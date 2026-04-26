import CategoryView from "../../../src/CategoryView";
import { useLocalSearchParams } from "expo-router";
export default function MonthlyTab() {
  const { adminId } = useLocalSearchParams<{ adminId: string }>();
  return <CategoryView category="MONTHLY_RETURN" adminId={adminId} />;
}
