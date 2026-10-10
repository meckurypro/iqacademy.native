// src/app/(app)/_layout.tsx
// The signed-in app. One Tabs navigator holds EVERY signed-in route so the bottom bar stays visible everywhere, like the web.
// Which buttons the bar shows is decided by role (shell/TabBar), not by which files exist.
import { useEffect } from "react";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { usePushRefresh } from "@/native/notify";
import { allowedHere } from "@/shell/guards";
import { useTheme } from "@/theme/ThemeProvider";
import TabBar from "@/shell/TabBar";
import { clearPending, getPending } from "@/shared/verify";

// Right after a new user confirms their email (in this app or another device), show the "you're verified" screen once. (web: VerifyRedirect)
function useVerifyRedirect() {
  const { session } = useAuth(); const router = useRouter(); const path = usePathname();
  useEffect(() => {
    const pend = getPending(); if (!pend || !session) return;
    if (pend.email !== session.user.email?.toLowerCase()) { clearPending(); return; }
    if (path !== "/verify-email") router.replace("/verify-email");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
}

export default function AppLayout() {
  const { roles, session } = useAuth(); const path = usePathname(); const { p } = useTheme();
  useVerifyRedirect();
  usePushRefresh(session?.user.id); // refreshes the push token if notifications are already allowed; forgets this phone on sign-out
  if (!allowedHere(path, roles.map((r) => r.role))) return <Redirect href="/" />;
  return <Tabs tabBar={() => <TabBar />} backBehavior="history" screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: p.c.bg } }} />;
}
