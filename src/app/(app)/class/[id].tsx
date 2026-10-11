import { useLocalSearchParams } from "expo-router";
import ClassScreen from "@/features/class/ClassScreen";
import { Screen } from "@/shell/Screen";

export default function Route() {
  const { id, reveal } = useLocalSearchParams<{ id: string; reveal?: string }>();
  return <Screen><ClassScreen id={id} reveal={reveal} /></Screen>;
}
