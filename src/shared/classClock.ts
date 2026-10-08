// PORT-OF web src/lib/classClock.ts @0081e66 — pure part (types, phases, duration helpers). `useTicker` and `useClassClock` belong to M7a/M9a.
import { CHECKIN_OPENS_MIN } from "./web/consts";

export type ClockClass = {
  id: string; start_at: string; end_at: string; status: string; as_role: "student" | "instructor" | "staff";
  is_emergency: boolean; course_title: string; lesson_title: string | null; room: string | null;
  centre_id: string; centre_name: string; centre_city: string | null; centre_address: string | null;
  instructor_name: string | null; checkin_opens_at: string;
};

/** upcoming: more than 30 min away. checkin: door open, class not started. live: in progress. over: finished. */
export type Phase = "upcoming" | "checkin" | "live" | "over";
export function phaseOf(c: Pick<ClockClass, "start_at" | "end_at">, at: number): Phase {
  const start = Date.parse(c.start_at), end = Date.parse(c.end_at);
  if (at >= end) return "over";
  if (at >= start) return "live";
  if (at >= start - CHECKIN_OPENS_MIN * 60000) return "checkin";
  return "upcoming";
}

/** Split a duration into whole days, hours, minutes and seconds (never negative). */
export function splitMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** "2 days 4 hours", "35 minutes": for screen readers, which should hear a calm sentence, not a ticking number. */
export function spoken(ms: number) {
  const { d, h, m } = splitMs(ms);
  const u = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (d > 0) return [u(d, "day"), h ? u(h, "hour") : ""].filter(Boolean).join(" ");
  if (h > 0) return [u(h, "hour"), m ? u(m, "minute") : ""].filter(Boolean).join(" ");
  return m > 0 ? u(m, "minute") : "less than a minute";
}
