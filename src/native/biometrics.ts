// src/native/biometrics.ts
// Device side of M12: what the phone can do (fingerprint, face, screen lock) and a single `authenticate` call. Falls back to the phone's own PIN, pattern or
// password, so people without biometrics are covered too. No new permission: USE_BIOMETRIC and the Face ID text are already in app.config.ts.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { classifyAuthError, type AuthFailure } from "@/features/security/policy";

export type Capability = { loading: boolean; /** the phone has something to check against (biometrics or a screen lock) */ enrolled: boolean; /** wording for prompts and settings */ label: string };

let prompting = 0;
/** True while the system sign-in dialog is up. The app loses focus while it shows, which must not count as "left the app". */
export const isPrompting = () => prompting > 0;

export async function getCapability(): Promise<Omit<Capability, "loading">> {
  try {
    const [hw, enrolled, types] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), LocalAuthentication.supportedAuthenticationTypesAsync()]);
    const level = await LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE);
    // A screen lock (PIN, pattern, password) counts even with no biometrics, so "enrolled" is: biometrics set up, or any device credential.
    const ok = enrolled || level !== LocalAuthentication.SecurityLevel.NONE;
    const T = LocalAuthentication.AuthenticationType;
    const label = !hw || !enrolled ? "your phone's screen lock"
      : types.includes(T.FACIAL_RECOGNITION) ? (Platform.OS === "ios" ? "Face ID" : "face unlock")
      : types.includes(T.FINGERPRINT) ? (Platform.OS === "ios" ? "Touch ID" : "your fingerprint") : "your phone's screen lock";
    return { enrolled: ok, label };
  } catch { return { enrolled: false, label: "your phone's screen lock" }; }
}

export function useCapability(): Capability {
  const [c, setC] = useState<Capability>({ loading: true, enrolled: false, label: "your phone's screen lock" });
  useEffect(() => { let alive = true; getCapability().then((x) => { if (alive) setC({ loading: false, ...x }); }); return () => { alive = false; }; }, []);
  return c;
}

export type AuthResult = { ok: true } | { ok: false; reason: AuthFailure };

/** Show the system prompt. `unavailable` means there is nothing to check against; callers decide what that means (the lock opens, a setting cannot be turned on). */
export async function authenticate(promptMessage: string): Promise<AuthResult> {
  prompting++;
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: "Cancel", disableDeviceFallback: false });
    if (r.success) return { ok: true };
    return { ok: false, reason: classifyAuthError(r.error) };
  } catch { return { ok: false, reason: "failed" }; }
  finally { setTimeout(() => { prompting = Math.max(0, prompting - 1); }, 400); } // the app's "active" event arrives just after the dialog closes
}
