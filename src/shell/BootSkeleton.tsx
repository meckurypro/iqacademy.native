import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Skeleton } from "@/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Shown while fonts, the session, the clock and roles load (web: two skeleton blocks). */
export function BootSkeleton() {
  const { p } = useTheme(); const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: p.c.bg, paddingTop: insets.top + 24, paddingHorizontal: 24, gap: 12 }}><Skeleton height={40} /><Skeleton height={160} /></View>;
}
