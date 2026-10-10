import { useLocalSearchParams } from "expo-router";
import Team from "@/features/staff/Team";
import { Screen } from "@/shell/Screen";

export default function Route() {
  const { centreId } = useLocalSearchParams<{ centreId: string }>();
  return <Screen><Team centreId={centreId} /></Screen>;
}
