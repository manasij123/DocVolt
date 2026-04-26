import CategoryView from "../../../src/CategoryView";
import { useLocalSearchParams } from "expo-router";
export default function IfaTab() {
  const { adminId } = useLocalSearchParams<{ adminId: string }>();
  return <CategoryView category="IFA_REPORT" adminId={adminId} />;
}
