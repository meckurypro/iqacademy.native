import { useLocalSearchParams } from "expo-router";
import CourseBuilder from "@/features/admin-classes/CourseBuilder";
import { Screen } from "@/shell/Screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Screen><CourseBuilder id={id} /></Screen>;
}
