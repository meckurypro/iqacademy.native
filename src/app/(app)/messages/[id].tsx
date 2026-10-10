import { useLocalSearchParams } from "expo-router";
import ClassChannel from "@/features/channels/ClassChannel";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClassChannel id={String(id)} />;
}
