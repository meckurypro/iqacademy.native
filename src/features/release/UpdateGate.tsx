// src/features/release/UpdateGate.tsx
// Two release safety nets (M14), mounted once in the root layout:
//  1. Forced upgrade: when `app_settings.min_native_version` for this platform is higher than this build, a full-screen "Update required" replaces the app.
//     The setting is readable by everyone, so it works signed out too. It fails open (see version.ts) and never blocks when offline with nothing cached.
//  2. Over-the-air updates: when the app comes back to the foreground (at most every 15 minutes) it checks for an update; if one downloads, it offers to restart now or later.
//     Skipped in development and in builds without updates (no EAS project id), where expo-updates is disabled.
import { useCallback, useEffect, useRef } from "react";
import { AppState, Linking, Modal, Platform, View } from "react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { ok } from "@/core/errors";
import { useQuery } from "@/data";
import { AppIcon } from "@/features/auth/AuthShell";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Text, useFeedback } from "@/ui";
import { minFor, needsUpgrade } from "./version";

const CHECK_EVERY_MS = 15 * 60_000;
// Metro inlines these only when written out in full. Set them as EAS environment variables once the store listings exist (docs/release.md).
const STORE_URL = Platform.OS === "ios" ? process.env.EXPO_PUBLIC_STORE_URL_IOS : process.env.EXPO_PUBLIC_STORE_URL_ANDROID;
const storeUrl = () => STORE_URL || (Platform.OS === "android" && Application.applicationId ? `market://details?id=${Application.applicationId}` : undefined);

export function UpdateGate() {
  const { p } = useTheme(); const { confirm } = useFeedback();
  const q = useQuery<unknown>({ key: ["min-native-version"], tags: ["app-settings"], ttlMs: 10 * 60_000,
    fn: async (sb) => (ok(await sb.from("app_settings").select("value").eq("key", "min_native_version").maybeSingle()) as { value: unknown } | null)?.value ?? null });
  const min = minFor(q.data, Platform.OS);
  const blocked = needsUpgrade(Application.nativeApplicationVersion, min);

  const lastCheck = useRef(0); const busy = useRef(false);
  const { refetch } = q;
  const checkForUpdate = useCallback(async () => {
    if (!Updates.isEnabled || busy.current || Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
    busy.current = true; lastCheck.current = Date.now();
    try {
      const c = await Updates.checkForUpdateAsync();
      if (!c.isAvailable) return;
      const f = await Updates.fetchUpdateAsync();
      if (!f.isNew) return;
      if (await confirm({ title: "Update ready", message: "A new version of IQ Academy has downloaded. Restart to use it.", confirmLabel: "Restart now", cancelLabel: "Later" })) await Updates.reloadAsync();
    } catch { /* offline or the update service is down: try again at the next foreground */ }
    finally { busy.current = false; }
  }, [confirm]);

  useEffect(() => {
    checkForUpdate();
    const s = AppState.addEventListener("change", (st) => { if (st === "active") { refetch(); checkForUpdate(); } });
    return () => s.remove();
  }, [checkForUpdate, refetch]);

  if (!blocked) return null;
  const url = storeUrl();
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: p.c.bg, alignItems: "center", justifyContent: "center", gap: 20, padding: 32 }}>
        <AppIcon size={64} />
        <View style={{ alignItems: "center", gap: 6, maxWidth: 320 }}>
          <Text size={22} weight="semibold" align="center" accessibilityRole="header">Update required</Text>
          <Text tone="muted" align="center">{`This version of IQ Academy is out of date. Update it from the ${Platform.OS === "ios" ? "App Store" : "Play Store"} to keep going.`}</Text>
        </View>
        {url && <View style={{ width: "100%", maxWidth: 320 }}><Button onPress={() => { Linking.openURL(url).catch(() => {}); }}>{`Open the ${Platform.OS === "ios" ? "App Store" : "Play Store"}`}</Button></View>}
      </View>
    </Modal>
  );
}
