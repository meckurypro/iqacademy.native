// src/features/release/version.ts
// Version comparison for the forced-upgrade gate (M14). Pure, so it is tested (tests/release.test.ts).
// `app_settings.min_native_version` is `{ "ios": "1.0.0", "android": "1.0.0" }`: raising a number there forces everyone below it onto the new store build.

/** "1.2.3" → [1,2,3]. Anything that is not dot-separated whole numbers is rejected (null). A leading "v" and a "-beta" tail are tolerated. */
export function parseVersion(v: string | null | undefined): number[] | null {
  if (typeof v !== "string") return null;
  const m = /^v?(\d+(?:\.\d+)*)(?:[-+].*)?$/.exec(v.trim());
  return m ? m[1].split(".").map(Number) : null;
}

/** -1 if a < b, 0 if equal, 1 if a > b. Missing parts count as 0 ("1.2" equals "1.2.0"). null if either side cannot be read. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * Must this build be replaced? Fails OPEN: if either version cannot be read (an unset setting, a typo, a dev build) the app keeps working,
 * because a mistake in a setting must never lock every user out of the app.
 */
export function needsUpgrade(current: string | null | undefined, min: string | null | undefined): boolean {
  if (!current || !min) return false;
  return compareVersions(current, min) === -1;
}

/** Pick this platform's minimum out of the stored setting, ignoring anything that is not a string. */
export function minFor(setting: unknown, platform: "ios" | "android" | string): string | undefined {
  if (!setting || typeof setting !== "object") return undefined;
  const v = (setting as Record<string, unknown>)[platform];
  return typeof v === "string" ? v : undefined;
}
