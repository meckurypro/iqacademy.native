// src/features/security/settings.ts
// The three switches, kept on this phone (not secret, so the plain key-value store, not SecureStore). Read synchronously so the lock can be in place on the very first frame.
import { useSyncExternalStore } from "react";
import { kv } from "@/core/kv";
import { parseSettings, type SecuritySettings } from "./policy";

const KEY = "iq:security";
let cache: SecuritySettings | null = null;
const listeners = new Set<() => void>();

export const getSettings = (): SecuritySettings => (cache ??= parseSettings(kv.getJson(KEY)));
export function setSettings(patch: Partial<SecuritySettings>) {
  cache = parseSettings({ ...getSettings(), ...patch });
  kv.setJson(KEY, cache);
  listeners.forEach((l) => l());
}
export const useSecuritySettings = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, getSettings, getSettings);
