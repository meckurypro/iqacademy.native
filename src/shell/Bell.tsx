// Port of web Bell + useNotificationCount. Same rule: it only shows the unread count; the list is the /notifications screen.
import { Pressable, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useRpc } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, Text } from "@/ui";

export const useNotificationCount = () => useRpc<number>("unread_notification_count", {}, { tags: ["notifications"], ttlMs: 5 * 60_000 }).data ?? 0;

export function Badge({ n, style }: { n: number; style?: object }) {
  const { p } = useTheme();
  if (n <= 0) return null;
  return (
    <Animated.View entering={ZoomIn.duration(400)} style={[{ position: "absolute", minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: p.c.bad, alignItems: "center", justifyContent: "center" }, style]}>
      <Text size={10} weight="semibold" lh={12} style={{ color: "#fff" }}>{n > 99 ? "99+" : n}</Text>
    </Animated.View>
  );
}

export default function Bell() {
  const { p } = useTheme(); const router = useRouter(); const here = usePathname() === "/notifications"; const count = useNotificationCount();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : "Notifications"} onPress={() => router.navigate("/notifications")}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: here || pressed ? p.c.sunken : "transparent" })}>
      <View><Icon name="bell" size={21} color={p.a("ink", 0.8)} /></View>
      <Badge n={count} style={{ right: 4, top: 4 }} />
    </Pressable>
  );
}
