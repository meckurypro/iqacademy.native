// M11b: keeps the calendar current while the app is open. Mount once under the signed-in layout: `useCalendarAutoSync()`.
// It reads the same class list the countdown uses (server-corrected, cached), so it works from the cache when offline and re-runs when classes change ("sessions" tag).
import { useEffect } from "react";
import { useAuth } from "@/core/auth";
import { onBeforeSignOut, useQuery } from "@/data";
import { FETCH_LIMIT, type CalClass } from "./plan";
import { disableCalendar, syncCalendar } from "./sync";
import { getCal, useCalState } from "./store";

export function useCalendarAutoSync() {
  const { enabled } = useCalState(); const uid = useAuth().session?.user.id;
  // Signing out removes the classes this person put in the phone's calendar, so the next person on a shared phone does not see them. Offline-safe: it is all on the device.
  useEffect(() => (uid ? onBeforeSignOut(async () => { if (getCal().enabled || getCal().calendarId) await disableCalendar(true); }) : undefined), [uid]);
  const q = useQuery<CalClass[]>({
    key: ["calendar-classes"], enabled, tags: ["sessions"], ttlMs: 5 * 60_000,
    fn: async (sb) => { const r = await sb.rpc("my_class_clock", { p_limit: FETCH_LIMIT }); if (r.error) throw r.error; return (r.data as CalClass[]) ?? []; },
  });
  const rows = q.data;
  useEffect(() => { if (enabled && rows) void syncCalendar(rows, rows.length >= FETCH_LIMIT); }, [enabled, rows]);
  return { loading: enabled && !rows };
}
