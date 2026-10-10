// src/features/student/hooks.ts
// Port of the hooks in web lib/checkin.ts (useCheckedIn) and lib/classClock.ts (useClassClock). M9a (instructor/class screen) and M9b reuse these.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/core/auth";
import { ok } from "@/core/errors";
import { useQuery } from "@/data";
import { CHECKIN_OPENS_MIN } from "@/shared/checkin";
import { phaseOf, type ClockClass } from "@/shared/classClock";
import { useTicker } from "@/shared/useTicker";
import { now as serverNow } from "@/shared/web/time";

/**
 * Is the signed-in student already marked present for this class? Refreshes when their attendance changes (the shared realtime channel tags "attendance")
 * and the moment a check-in finishes on this phone (the check-in call invalidates the same tag), so the Check in button never offers itself twice.
 */
export function useCheckedIn(sessionId: string | undefined, enabled = true) {
  const { session } = useAuth(); const uid = session?.user.id;
  const on = !!sessionId && !!uid && enabled;
  const q = useQuery<boolean>({
    key: ["checked-in", sessionId, uid], enabled: on, tags: ["attendance"], ttlMs: 30_000,
    fn: async (sb) => (ok(await sb.from("attendance").select("status").eq("session_id", sessionId!).eq("student_id", uid!).maybeSingle()) as { status: string } | null)?.status === "present",
  });
  return on ? q.data ?? false : false;
}

type Plain = Omit<ClockClass, "as_role" | "checkin_opens_at">;

/**
 * The caller's live and upcoming classes (as a student, instructor or the centre's coordinator), soonest first, from the server.
 * Shown from the class's own timestamps and the server-corrected clock, never a decremented counter, so a phone that slept is exactly right on waking.
 */
export function useClassClock(limit = 3, fallbackStudent = false) {
  const now = useTicker(1000);
  const q = useQuery<{ rows: ClockClass[]; failed: boolean }>({
    key: ["class-clock", limit, fallbackStudent], tags: ["sessions"], ttlMs: 60_000,
    fn: async (sb) => {
      const r = await sb.rpc("my_class_clock", { p_limit: limit });
      if (!r.error) return { rows: (r.data as ClockClass[]) ?? [], failed: false };
      // Until the function exists a student must never lose their Check-in button over it: fall back to the next class visible to them.
      if (!fallbackStudent) return { rows: [], failed: true };
      const f = ok(await sb.from("v_session_details").select("id,start_at,end_at,status,is_emergency,course_title,lesson_title,room,centre_id,centre_name,centre_city,centre_address,instructor_name")
        .in("status", ["scheduled", "in_progress"]).gte("end_at", new Date(serverNow()).toISOString()).order("start_at").limit(limit)) as Plain[] | null;
      return { rows: (f ?? []).map((x) => ({ ...x, as_role: "student" as const, checkin_opens_at: new Date(Date.parse(x.start_at) - CHECKIN_OPENS_MIN * 60000).toISOString() })), failed: true };
    },
  });
  const rows = q.data?.rows;
  // What the screen shows: classes that haven't finished by the clock, even if the server hasn't marked them so yet.
  const upcoming = useMemo(() => (rows ?? []).filter((c) => phaseOf(c, now) !== "over"), [rows, now]);
  const current = upcoming[0] ?? null;
  const next = current && phaseOf(current, now) === "live" ? upcoming[1] ?? null : null;

  // When the current class changes phase, or one finishes, re-read the server a few seconds later so its state (the cron runs once a minute) catches up. Not on first load.
  const { refetch } = q;
  const reload = useCallback(() => { refetch(); }, [refetch]);
  const key = current ? `${current.id}:${phaseOf(current, now)}` : "none";
  const prev = useRef<{ key: string; len: number } | null>(null);
  useEffect(() => {
    if (rows === undefined) return;
    const p = prev.current; prev.current = { key, len: upcoming.length };
    if (p && ((p.key !== key && p.key !== "none") || upcoming.length < p.len)) { const id = setTimeout(reload, 3000); return () => clearTimeout(id); }
  }, [rows, key, upcoming.length, reload]);

  return { loading: rows === undefined && q.loading, failed: q.data?.failed ?? false, current, next, now, reload };
}
