// src/features/security/AppLock.tsx
// The app lock (M12): when switched on, the app asks for fingerprint, face or the phone's screen lock when it opens and when it comes back after the grace time.
//  * Shown as a Modal so it sits above any sheet or dialog that was open when the app was left.
//  * The app switcher thumbnail is covered while the app is not in focus (only when the lock is on).
//  * The stored session is untouched: the lock is a gate on the screen, so push, background sync and the encrypted database keep working (PLAN D4).
//  * If the phone has no screen lock any more, the app opens rather than trapping the person out. "Sign out" is always available on the lock screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, View } from "react-native";
import { useAuth } from "@/core/auth";
import { signOutAndWipe } from "@/data";
import { authenticate, getCapability, isPrompting } from "@/native/biometrics";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Icon, Text, useFeedback } from "@/ui";
import { AppIcon } from "@/features/auth/AuthShell";
import { shouldLockOnResume } from "./policy";
import { getSettings, useSecuritySettings } from "./settings";
import { clearStrongAuth, markStrongAuth } from "./stepUp";

export function AppLock() {
  const { p } = useTheme(); const { session } = useAuth(); const { run, confirm } = useFeedback();
  const settings = useSecuritySettings(); const signedIn = !!session;
  // Locked from the first frame when the lock is on and someone is signed in (a cold start).
  const [lockedRaw, setLocked] = useState(() => getSettings().appLock);
  const [covered, setCovered] = useState(false);
  const leftAt = useRef<number | null>(null); const busy = useRef(false);
  const enabled = settings.appLock && signedIn;
  const locked = enabled && lockedRaw;

  const unlock = useCallback(async () => {
    if (busy.current) return; busy.current = true;
    try {
      const cap = await getCapability();
      if (!cap.enrolled) { setLocked(false); return; }  // nothing to check against: never trap the person out
      const r = await authenticate("Unlock IQ Academy");
      if (r.ok) { markStrongAuth(); setLocked(false); }
      else if (r.reason === "unavailable") setLocked(false);
    } finally { busy.current = false; }
  }, []);

  // Whenever the lock switches on or off (the setting, or signing in or out) it starts open: signing in just proved who this is, turning the lock on must not lock the
  // person out of the screen they are on, and turning it off clears any pending lock. A cold start has no such change, so it stays locked.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) { setWasEnabled(enabled); setLocked(false); }
  // Signing out forgets the recent confirmation.
  useEffect(() => { if (!signedIn) clearStrongAuth(); }, [signedIn]);
  // On a cold start the lock is already up: ask straight away.
  useEffect(() => { if (locked) unlock(); }, [locked, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (isPrompting()) return; // the system dialog takes focus while it is up; that is not "leaving the app"
      const s = getSettings();
      if (state === "active") {
        setCovered(false);
        if (shouldLockOnResume({ enabled: s.appLock, leftAt: leftAt.current, now: Date.now(), graceSec: s.graceSec })) setLocked(true);
        leftAt.current = null;
      } else {
        if (leftAt.current === null) leftAt.current = Date.now();
        if (s.appLock) setCovered(true);
      }
    });
    return () => sub.remove();
  }, []);

  if (!enabled || !(locked || covered)) return null;
  return (
    <Modal visible animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: p.c.bg, alignItems: "center", justifyContent: "center", gap: 20, padding: 32 }}>
        <AppIcon size={64} />
        {locked && (
          <>
            <View style={{ alignItems: "center", gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="lock" size={20} color={p.c.muted} /><Text size={20} weight="semibold">IQ Academy is locked</Text></View>
              <Text tone="muted" align="center">Unlock to continue.</Text>
            </View>
            <View style={{ width: "100%", maxWidth: 320, gap: 8 }}>
              <Button onPress={unlock}>Unlock</Button>
              <Button variant="ghost" onPress={() => { run("Signing out…", () => signOutAndWipe(confirm)); }}>Sign out</Button>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
