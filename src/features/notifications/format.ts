// Port of the wording helpers in web pages/Notifications.tsx. Pure, so the headline rules are tested.
import { addDays, dayOf, fmtClock, fmtWhen, now, relativeDay, today } from "@/shared/web/time";

export type Note = { id: string; title: string; body: string | null; read_at: string | null; created_at: string; sender_label: string | null; type: string; data: { start_at?: string; log_id?: string; disputed?: boolean } | null };
export const PAGE = 30;

/**
 * A class reminder is written once, when it is sent, but it is read later. So its headline is worked out again from the
 * class's own start time and the server-corrected clock: "Class in 4 minutes" is never still "Class in 1 hour".
 */
export const reminderTitle = (n: Pick<Note, "type" | "title" | "data">, at: number) => {
  const start = n.data?.start_at ? Date.parse(n.data.start_at) : NaN;
  if (!n.type.startsWith("class_reminder") || Number.isNaN(start)) return n.title;
  const tail = n.type === "class_reminder_staff" ? " at your centre" : "";
  const mins = Math.ceil((start - at) / 60000);
  if (mins > 62) return `Class in ${Math.round(mins / 60)} hours${tail}`;
  if (mins >= 58) return `Class in 1 hour${tail}`;
  if (mins > 1) return `Class in ${mins} minutes${tail}`;
  if (mins === 1 || at < start) return `Class starts now${tail}`;
  const ago = Math.floor((at - start) / 60000);
  if (ago < 180) return ago < 1 ? `Class has started${tail}` : `Class started ${ago} min ago${tail}`;
  return `${relativeDay(start, { weekday: "short", day: "numeric", month: "short" })}, ${fmtClock(start)} class${tail}`;
};

export const when = (d: string, at: number = now()) => {
  const mins = Math.round((at - Date.parse(d)) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (dayOf(d) === today()) return fmtClock(d);
  if (dayOf(d) === addDays(today(), -1)) return "Yesterday";
  return fmtWhen(d, { day: "numeric", month: "short", ...(dayOf(d).slice(0, 4) === today().slice(0, 4) ? {} : { year: "numeric" as const }) });
};

/** The link a notification of this type offers, if any (web: the small accent links under the title). */
export function noteLink(type: string): { to: string; label: string } | null {
  if (type.startsWith("run_") && type !== "run_cancelled") return { to: "/schedule", label: "Open schedule" };
  if (["class_assigned", "class_unassigned", "class_changed"].includes(type)) return { to: "/my-classes", label: "Open my classes" };
  if (["emergency_class", "custom_class_invite", "custom_class_changed"].includes(type)) return { to: "/", label: "Go to check-in" };
  return null;
}
