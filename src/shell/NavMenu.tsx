// Port of web NavMenu: the right-hand drawer. Tabs live in the bottom bar, so the drawer only adds what the bar doesn't have.
import { useCallback, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter, usePathname, type Href } from "expo-router";
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { primaryRole, roleLabel, useAuth } from "@/core/auth";
import { signOutAndWipe } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, shadow } from "@/theme/tokens";
import { haptic } from "@/native/haptics";
import { Avatar, BLUR, Icon, Text, useFeedback } from "@/ui";
import { useExitMount } from "@/ui/useExitMount";
import { BlurView } from "expo-blur";
import { EXTRA, TABS, type NavItem } from "./nav.generated";

export default function NavMenu() {
  const { p } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter(); const path = usePathname();
  const { name, avatar, roles } = useAuth(); const { run, confirm } = useFeedback();
  const role = primaryRole(roles);
  const [open, setOpen] = useState(false); const mounted = useExitMount(open);
  const items: NavItem[] = [...(TABS[role] ? [] : [["/", "Home", "home"] as NavItem]), ...(EXTRA[role] ?? [])];

  const close = useCallback(() => setOpen(false), []);
  const go = (to: string) => { close(); router.navigate(to as Href); };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Open menu" accessibilityState={{ expanded: open }} onPress={() => { haptic.tap(); setOpen(true); }}
        style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? p.c.sunken : "transparent" })}>
        <View style={{ width: 18, alignItems: "flex-end", gap: 5 }} importantForAccessibility="no-hide-descendants">
          {[1, 0.75, 0.5].map((w) => <View key={w} style={{ height: 2, width: `${w * 100}%`, borderRadius: 1, backgroundColor: p.c.ink }} />)}
        </View>
      </Pressable>
      {mounted && (
        <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={close}>
          {open && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
              <Pressable accessibilityLabel="Close menu" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,.5)" }]}>{BLUR && <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />}</Pressable>
            </Animated.View>
          )}
          {open && (
            <Animated.View entering={SlideInRight.duration(280)} exiting={SlideOutRight.duration(200)} accessibilityViewIsModal accessibilityLabel="Menu"
              style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "85%", maxWidth: 320, backgroundColor: p.c.surface, borderTopLeftRadius: radius["3xl"], borderBottomLeftRadius: radius["3xl"], borderWidth: 1, borderColor: p.c.line, padding: 16, paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom, ...shadow.sheet }}>
              <View style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text size={13} weight="semibold" tone="muted" upper tracking={0.05} lh={19} style={{ paddingHorizontal: 4 }}>Menu</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={close} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? p.c.sunken : "transparent" })}>
                  <Icon name="close" size={18} color={p.c.muted} />
                </Pressable>
              </View>
              <Pressable accessibilityRole="link" onPress={() => go("/profile")} style={({ pressed }) => ({ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius["2xl"], backgroundColor: p.a("sunken", 0.7), borderWidth: 1, borderColor: p.c.line, padding: 12, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <Avatar name={name || "?"} url={avatar} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" lh={20} numberOfLines={1}>{name}</Text><Text size={12} tone="muted">{roleLabel[role]}</Text></View>
                <Icon name="chevronRight" size={18} color={p.c.muted} />
              </Pressable>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 4 }}>
                {items.map(([to, label, icon]) => {
                  const active = path === to;
                  return (
                    <Pressable key={to} accessibilityRole="link" accessibilityState={{ selected: active }} onPress={() => go(to)}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.xl, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: active ? p.a("accent", 0.1) : pressed ? p.c.sunken : "transparent" })}>
                      <View style={{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: active ? p.a("accent", 0.15) : p.c.sunken }}><Icon name={icon} size={20} color={active ? p.c.accent : p.c.muted} /></View>
                      <Text size={15} weight={active ? "medium" : "regular"} tone={active ? "accent" : "ink"}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={{ flex: 1 }} />
              <Pressable accessibilityRole="button" onPress={() => { close(); run("Signing out…", () => signOutAndWipe(confirm)); }}
                style={({ pressed }) => ({ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.xl, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: pressed ? p.c.sunken : "transparent" })}>
                <View style={{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: p.c.sunken }}><Icon name="arrowLeft" size={18} color={p.c.muted} /></View>
                <Text size={15} tone="muted">Sign out</Text>
              </Pressable>
              <Text size={12} lh={19.5} style={{ color: p.a("muted", 0.8), paddingHorizontal: 4 }}>
                {"IQ Academy is "}
                <Text size={12} lh={19.5} onPress={() => Linking.openURL("https://promptiq.com.ng?utm_source=academy_app&utm_medium=menu")} style={{ textDecorationLine: "underline", color: p.a("muted", 0.8) }}>PromptIQ</Text>
                {"'s school. Learn AI from the team that builds with it."}
              </Text>
            </Animated.View>
          )}
        </Modal>
      )}
    </>
  );
}
