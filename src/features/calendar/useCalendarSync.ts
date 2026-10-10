// M11b: keeps the calendar current while the app is open. Mount once under the signed-in layout: `useCalendarAutoSync()`.
// It reads the same class list the countdown uses (server-corrected, cached), so it works from the cache when offline and re-runs when classes change ("sessions" tag).
import { useEffect } from "react";
import { useQuery } from "@/data";
import { FETCH_LIMIT, type CalClass } from "./plan";
import { syncCalendar } from "./sync";
import { useCalState } from "./store";

export function useCalendarAutoSync() {
  const { enabled } = useCalState();
  const q = useQuery<CalClass[]>({
    key: ["calendar-classes"], enabled, tags: ["sessions"], ttlMs: 5 * 60_000,
    fn: async (sb) => { const r = await sb.rpc("my_class_clock", { p_limit: FETCH_LIMIT }); if (r.error) throw r.error; return (r.data as CalClass[]) ?? []; },
  });
  const rows = q.data;
  useEffect(() => { if (enabled && rows) void syncCalendar(rows, rows.length >= FETCH_LIMIT); }, [enabled, rows]);
  return { loading: enabled && !rows };
}
