// Root: providers, then the signed-out / signed-in split. Order matters:
//   Theme → Feedback (toasts, busy overlay, confirm) → Session → Data (encrypted per-user cache + outbox) → Auth (roles, name) → gate
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "@/core/auth";
import { ClockSkewContext, useClockSync } from "@/core/clock";
import { env } from "@/core/env";
import { SessionProvider } from "@/core/session";
import { DataProvider } from "@/data";
import { setupNotifications } from "@/native/notify";
import { BootSkeleton } from "@/shell/BootSkeleton";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useAppFonts } from "@/theme/fonts";
import { FeedbackProvider, Text } from "@/ui";
import { View } from "react-native";

export { ErrorBoundary } from "expo-router";
SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const fontsReady = useAppFonts();
  const { session, loading, rolesReady } = useAuth();
  const { ready: clockReady, skew } = useClockSync(!!session);
  // web waits for the first clock reading (max 2.5 s) before showing signed-in screens; we also wait for roles so the wrong home never flashes
  const booting = loading || !fontsReady || (!!session && (!clockReady || !rolesReady));
  useEffect(() => { if (!booting) SplashScreen.hideAsync().catch(() => {}); }, [booting]);
  useEffect(() => { setupNotifications().catch((e) => console.warn("[push] setup failed", e)); }, []);
  if (booting) return <BootSkeleton />;
  return (
    <ClockSkewContext.Provider value={skew}>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Protected guard={!session}><Stack.Screen name="(public)" /></Stack.Protected>
        <Stack.Protected guard={!!session}><Stack.Screen name="(app)" /></Stack.Protected>
        {/* reachable signed in or out: a confirmation or recovery link signs the person in first */}
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="auth/callback" />
      </Stack>
    </ClockSkewContext.Provider>
  );
}

function NotConfigured() {
  return <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 8 }}><Text weight="semibold" size={20}>App is not configured</Text><Text tone="muted">Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example), then rebuild.</Text></View>;
}

export default function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {!env.configured ? <NotConfigured /> : (
            <FeedbackProvider>
              <SessionProvider>
                <DataProvider fallback={<BootSkeleton />}>
                  <AuthProvider><Gate /></AuthProvider>
                </DataProvider>
              </SessionProvider>
            </FeedbackProvider>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
