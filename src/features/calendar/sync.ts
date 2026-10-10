// M11b: apply a plan to the device calendar. One run at a time; never throws; a failed event is retried on the next run because it is not written into the map.
import { createEvent, deleteCalendar, deleteEvent, ensureCalendar, ensurePermission, updateEvent, type EventSpec } from "@/native/calendar";
import { eventLocation, eventNotes, eventTitle, planSync, signature, type CalClass, type Mapped } from "./plan";
import { getCal, resetCal, setCal } from "./store";

export type SyncResult = { ok: true; created: number; updated: number; removed: number } | { ok: false; reason: "off" | "permission" | "calendar" };
const spec = (c: CalClass): EventSpec => ({ title: eventTitle(c), startMs: Date.parse(c.start_at), endMs: Date.parse(c.end_at), location: eventLocation(c), notes: eventNotes() });

let chain: Promise<unknown> = Promise.resolve();
/** Bring the calendar in line with `classes` (the caller's upcoming classes). `truncated`: the server sent a full page, so later classes may exist. */
export function syncCalendar(classes: CalClass[], truncated: boolean, nowMs = Date.now()): Promise<SyncResult> {
  const run = chain.then(() => doSync(classes, truncated, nowMs), () => doSync(classes, truncated, nowMs));
  chain = run.catch(() => undefined);
  return run;
}

async function doSync(classes: CalClass[], truncated: boolean, nowMs: number): Promise<SyncResult> {
  const st = getCal();
  if (!st.enabled) return { ok: false, reason: "off" };
  if (!(await ensurePermission())) return { ok: false, reason: "permission" };
  const calId = await ensureCalendar(st.calendarId);
  if (!calId) return { ok: false, reason: "calendar" };
  // A different calendar id means the old one was deleted by the person: everything we remembered is gone with it.
  const map: Record<string, Mapped> = calId === st.calendarId ? { ...st.map } : {};
  const plan = planSync(classes, map, nowMs, truncated);
  let created = 0, updated = 0, removed = 0;
  for (const c of plan.create) { const id = await createEvent(calId, spec(c)); if (id) { map[c.id] = { eventId: id, sig: signature(c), startMs: Date.parse(c.start_at) }; created++; } }
  for (const u of plan.update) {
    if (await updateEvent(u.eventId, spec(u.cls))) { map[u.cls.id] = { eventId: u.eventId, sig: signature(u.cls), startMs: Date.parse(u.cls.start_at) }; updated++; }
    else { const id = await createEvent(calId, spec(u.cls)); if (id) { map[u.cls.id] = { eventId: id, sig: signature(u.cls), startMs: Date.parse(u.cls.start_at) }; updated++; } } // the event was deleted by hand: put it back
  }
  for (const r of plan.remove) { await deleteEvent(r.eventId); delete map[r.id]; removed++; }
  for (const id of plan.forget) delete map[id];
  setCal({ calendarId: calId, map, lastSyncAt: nowMs });
  return { ok: true, created, updated, removed };
}

/** Turn off. `removeEvents` also deletes the app's calendar and everything in it; otherwise the events already written stay. */
export async function disableCalendar(removeEvents: boolean) {
  const st = getCal();
  if (removeEvents) { if (st.calendarId && (await ensurePermission())) await deleteCalendar(st.calendarId); resetCal(); }
  else setCal({ enabled: false });
}
