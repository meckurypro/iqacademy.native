// src/app/(public)/_layout.tsx
import { Stack } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";

export const unstable_settings = { initialRouteName: "welcome" };
export default function PublicLayout() {
  const { p } = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: p.c.bg } }} />;
}
