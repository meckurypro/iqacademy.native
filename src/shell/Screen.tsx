// The page frame every signed-in screen sits in (web: MobileShell): solid strip under the status bar, header, clock notice, scrolling content in a
// max-w-2xl column, error boundary. The tab bar is rendered by the (app) layout, so content only needs a little bottom space.
import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { primaryRole, useAuth } from "@/core/auth";
import { useClockSkew } from "@/core/clock";
import { useTheme } from "@/theme/ThemeProvider";
import { Heading } from "@/ui";
import Bell from "./Bell";
import { PendingChip } from "./PendingSheet";
import { ProfileButton } from "./ProfileButton";
import ClockNotice from "./ClockNotice";
import ErrorBoundary from "./ErrorBoundary";
import NavMenu from "./NavMenu";
import { hasTabBar } from "./TabBar";

export function Header() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 672, width: "100%", alignSelf: "center" }}>
      <Pressable accessibilityRole="link" accessibilityLabel="Home" onPress={() => router.navigate("/")} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image source={require("../../assets/images/icon-192.png")} style={{ width: 36, height: 36, borderRadius: 10 }} accessibilityIgnoresInvertColors />
        <Heading size={20} lh={20}>Academy</Heading>
      </Pressable>
      <View style={{ flex: 1 }} />
      <PendingChip />
      <Bell />
      <ProfileButton />
      <NavMenu />
    </View>
  );
}

export function Screen({ children, onRefresh, refreshing = false }: { children?: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  const { p } = useTheme(); const insets = useSafeAreaInsets(); const path = usePathname(); const skew = useClockSkew();
  const { roles } = useAuth(); const tabs = hasTabBar(primaryRole(roles));
  return (
    <View style={{ flex: 1, backgroundColor: p.c.bg, paddingTop: insets.top }}>
      <Header />
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.c.accent} colors={[p.c.accent]} /> : undefined}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 + (tabs ? 0 : insets.bottom), maxWidth: 672, width: "100%", alignSelf: "center" }}>
        <ClockNotice skew={skew} />
        <ErrorBoundary resetKey={path}>{children}</ErrorBoundary>
      </ScrollView>
    </View>
  );
}
