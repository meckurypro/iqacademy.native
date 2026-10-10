// M11b: the pure part of calendar sync (no React, no native). One-way and opt-in: the app writes its upcoming classes into a calendar of its own and never reads the person's other events.
// Events carry absolute instants (the class's own timestamps), so they land at the right moment on any phone; text never embeds a clock time, so there is no second timezone to get wrong.
import type { ClockClass } from "@/shared/classClock";

export type CalClass = Pick<ClockClass, "id" | "start_at" | "end_at" | "status" | "course_title" | "lesson_title" | "centre_name" | "centre_city" | "centre_address" | "room">;
/** What we remember about an event we made: where it is, what it looked like, and when it starts (to tell future from past). */
export type Mapped = { eventId: string; sig: string; startMs: number };
export type Plan = { create: CalClass[]; update: { cls: CalClass; eventId: string }[]; remove: { id: string; eventId: string }[]; forget: string[] };

/** Only classes starting within this many days are written, so the calendar stays short. */
export const WINDOW_DAYS = 28;
/** How many classes we ask the server for. A full answer means the list may have been cut off. */
export const FETCH_LIMIT = 30;

export const eventTitle = (c: CalClass) => (c.lesson_title ? `${c.course_title}: ${c.lesson_title}` : c.course_title);
export const eventLocation = (c: CalClass) => [c.centre_name, c.room, c.centre_address ?? c.centre_city].filter(Boolean).join(", ");
export const eventNotes = () => "Added by IQ Academy. Times can change: the app keeps this event up to date.";
/** Changes whenever anything shown in the event changes. */
export const signature = (c: CalClass) => [c.start_at, c.end_at, eventTitle(c), eventLocation(c)].join("|");

/**
 * What to do so the calendar matches the classes. `truncated` means the server returned a full page, so classes after the last one may exist and just were not sent:
 * nothing beyond that point is removed, however it looks.
 */
export function planSync(classes: CalClass[], mapped: Record<string, Mapped>, nowMs: number, truncated = false): Plan {
  const horizon = nowMs + WINDOW_DAYS * 86400_000;
  const live = classes.filter((c) => c.status !== "cancelled" && Date.parse(c.end_at) > nowMs && Date.parse(c.start_at) < horizon);
  const wanted = new Set(live.map((c) => c.id));
  const lastSeen = truncated && classes.length ? Math.max(...classes.map((c) => Date.parse(c.start_at))) : Infinity;
  const plan: Plan = { create: [], update: [], remove: [], forget: [] };
  for (const c of live) { const m = mapped[c.id]; if (!m) plan.create.push(c); else if (m.sig !== signature(c)) plan.update.push({ cls: c, eventId: m.eventId }); }
  for (const [id, m] of Object.entries(mapped)) {
    if (wanted.has(id)) continue;
    if (m.startMs <= nowMs) plan.forget.push(id);                    // already happened: keep the event as a record, stop tracking it
    else if (m.startMs <= lastSeen) plan.remove.push({ id, eventId: m.eventId }); // cancelled or gone and still in the future
  }
  return plan;
}
