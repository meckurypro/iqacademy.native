// Port of web TabBar. Which tabs show depends on the role (nav.generated.ts); coordinators and directors have none (home lives in the drawer).
import { Pressable, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { primaryRole, useAuth } from "@/core/auth";
import { useRpc } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { haptic } from "@/native/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Text } from "@/ui";
import { Badge } from "./Bell";
import { TABS } from "./nav.generated";

/** Unread class messages for a student (badge on the Messages tab). Kept fresh by realtime tags "messages" and "attendance". */
const useUnreadMessages = (enabled: boolean) => useRpc<number>("unread_message_count", {}, { enabled, tags: ["messages", "attendance"], ttlMs: 5 * 60_000 }).data ?? 0;

export const hasTabBar = (role: string) => !!TABS[role];

export default function TabBar() {
  const { p } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter(); const path = usePathname();
  const { roles } = useAuth(); const role = primaryRole(roles); const items = TABS[role];
  const unread = useUnreadMessages(role === "student");
  if (!items) return null;
  return (
    <View accessibilityRole="tablist" style={{ backgroundColor: p.c.bg, borderTopWidth: 1, borderTopColor: p.c.line, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: "row", paddingHorizontal: 8, paddingTop: 6, maxWidth: 672, width: "100%", alignSelf: "center" }}>
        {items.map(([to, label, icon]) => {
          const active = path === to;
          return (
            <Pressable key={to} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={() => { if (!active) { haptic.select(); router.navigate(to as Href); } }} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 2, paddingBottom: 8 }}>
              {({ pressed }) => (
                <>
                  <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: active ? p.a("accent", 0.1) : pressed ? p.c.sunken : "transparent" }}>
                    <Icon name={icon} size={22} solid={active} color={active ? p.c.accent : p.c.muted} cutColor={active ? p.c.bg : p.c.bg} />
                    {role === "student" && to === "/messages" && <Badge n={unread} style={{ right: 4, top: 0 }} />}
                  </View>
                  <Text size={11} weight="medium" lh={16} tone={active ? "accent" : "muted"} numberOfLines={1}>{label}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
