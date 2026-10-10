// Pure helpers for push registration (no native imports, so they are unit-tested).
export const isExpoPushToken = (t: unknown): t is string => typeof t === "string" && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t) && t.length <= 200;
/** Arguments for the register_push_token database function. `localReminders` stays false until the app schedules class reminders itself, so the server keeps sending them. */
export function registerArgs(o: { token: string; platform: string; appVersion?: string | null; deviceName?: string | null; localReminders?: boolean }) {
  if (!isExpoPushToken(o.token)) throw new Error("invalid_push_token");
  if (o.platform !== "ios" && o.platform !== "android") throw new Error("invalid_push_token");
  return { p_token: o.token, p_platform: o.platform, p_device_name: o.deviceName ?? null, p_app_version: o.appVersion ?? null, p_local_reminders: o.localReminders ?? false };
}
export type PushState = "on" | "off" | "blocked" | "unavailable";
/** What to tell the person: `unavailable` when this build has no push project id (development builds without EAS set up). */
export const pushState = (o: { permission: "granted" | "denied" | "undetermined"; hasProject: boolean; registered: boolean }): PushState =>
  !o.hasProject ? "unavailable" : o.permission === "denied" ? "blocked" : o.permission === "granted" && o.registered ? "on" : "off";
