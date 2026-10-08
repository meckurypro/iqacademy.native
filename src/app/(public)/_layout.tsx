import { Stack } from "expo-router";

export const unstable_settings = { initialRouteName: "welcome" };
export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
