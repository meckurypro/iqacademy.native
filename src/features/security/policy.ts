// src/features/security/policy.ts
// The pure rules of device security (M12), kept free of React and native modules so they can be unit-tested (tests/security.test.ts).
// Biometrics is a LOCAL layer: it never replaces the server-verified check-in PIN (PLAN §3).

export type Grace = 0 | 60 | 300;
export const GRACES: { value: Grace; label: string }[] = [{ value: 0, label: "Immediately" }, { value: 60, label: "After 1 minute" }, { value: 300, label: "After 5 minutes" }];

export type SecuritySettings = {
  /** Ask for fingerprint, face or the phone's screen lock when the app opens or comes back. */
  appLock: boolean;
  /** How long the app may sit in the background before it locks. A short grace avoids a prompt every time someone checks a bank app or the payment page. */
  graceSec: Grace;
  /** Ask again before money actions (approve/decline payments, payouts, refunds). Only admins have those screens. */
  stepUp: boolean;
};
export const DEFAULT_SETTINGS: SecuritySettings = { appLock: false, graceSec: 60, stepUp: true };

/** Anything stored is untrusted until it has this shape; unknown or damaged values fall back to the defaults. */
export function parseSettings(raw: unknown): SecuritySettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const grace = GRACES.some((g) => g.value === o.graceSec) ? (o.graceSec as Grace) : DEFAULT_SETTINGS.graceSec;
  return { appLock: o.appLock === true, graceSec: grace, stepUp: typeof o.stepUp === "boolean" ? o.stepUp : DEFAULT_SETTINGS.stepUp };
}

/**
 * Should the app lock now that it is active again?
 * `leftAt` is when it went to the background (null if it never did). A clock that moved backwards while away counts as locked, so setting the
 * phone's clock back cannot be used to skip the lock.
 */
export function shouldLockOnResume(o: { enabled: boolean; leftAt: number | null; now: number; graceSec: number }): boolean {
  if (!o.enabled || o.leftAt === null) return false;
  const away = o.now - o.leftAt;
  return away < 0 || away >= o.graceSec * 1000;
}

/** How long a successful unlock or confirmation also covers the next sensitive action, so approving ten payments in a row asks once, not ten times. */
export const STEP_UP_WINDOW_MS = 2 * 60_000;

export function stepUpNeeded(o: { enabled: boolean; lastOkAt: number | null; now: number; windowMs?: number }): boolean {
  if (!o.enabled) return false;
  if (o.lastOkAt === null) return true;
  const since = o.now - o.lastOkAt;
  return since < 0 || since >= (o.windowMs ?? STEP_UP_WINDOW_MS);
}

export type AuthFailure = "cancelled" | "unavailable" | "failed";
/** Map the OS's error codes to what the app does: `unavailable` means the phone has nothing to check against (no lock screen set up), so the app must not trap the person out. */
export function classifyAuthError(code: string | undefined): AuthFailure {
  switch (code) {
    case "user_cancel": case "system_cancel": case "app_cancel": case "user_fallback": return "cancelled";
    case "not_enrolled": case "passcode_not_set": case "not_available": case "biometric_unavailable": case "no_hardware": return "unavailable";
    default: return "failed";
  }
}
