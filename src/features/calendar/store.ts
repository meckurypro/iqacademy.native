// M11b: what the person chose and what we have written, kept on this phone (not secret: plain key-value store).
import { useSyncExternalStore } from "react";
import { kv } from "@/core/kv";
import type { Mapped } from "./plan";

export type CalState = { enabled: boolean; calendarId: string | null; map: Record<string, Mapped>; lastSyncAt: number | null };
const KEY = "iq:calendar";
const EMPTY: CalState = { enabled: false, calendarId: null, map: {}, lastSyncAt: null };
let cache: CalState | null = null; const listeners = new Set<() => void>();

function parse(raw: unknown): CalState {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<CalState>;
  const map: Record<string, Mapped> = {};
  for (const [id, m] of Object.entries(o.map ?? {})) if (m && typeof m.eventId === "string" && typeof m.sig === "string" && typeof m.startMs === "number") map[id] = m;
  return { enabled: o.enabled === true, calendarId: typeof o.calendarId === "string" ? o.calendarId : null, map, lastSyncAt: typeof o.lastSyncAt === "number" ? o.lastSyncAt : null };
}
export const getCal = (): CalState => (cache ??= parse(kv.getJson(KEY)));
export function setCal(patch: Partial<CalState>) { cache = { ...getCal(), ...patch }; kv.setJson(KEY, cache); listeners.forEach((l) => l()); }
export const resetCal = () => { cache = { ...EMPTY }; kv.setJson(KEY, cache); listeners.forEach((l) => l()); };
export const useCalState = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, getCal, getCal);
export { parse as parseCalState };
