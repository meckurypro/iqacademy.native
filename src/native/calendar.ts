// src/native/calendar.ts — M11b device side. Uses expo-calendar's legacy API (stable across SDK 57). Write access only, and only to a calendar the app creates itself.
// Permission strings and the plugin are already in app.config.ts (no new binary). Every call is wrapped: a calendar problem must never break the app.
import { Platform } from "react-native";
import * as Cal from "expo-calendar/legacy";

const NAME = "IQ Academy";
export type EventSpec = { title: string; startMs: number; endMs: number; location: string; notes: string };

export async function ensurePermission(): Promise<boolean> {
  try { const cur = await Cal.getCalendarPermissionsAsync(); if (cur.granted) return true; return (await Cal.requestCalendarPermissionsAsync()).granted; } catch { return false; }
}

/** The id of the app's own calendar, created on first use (or again if the person deleted it). */
export async function ensureCalendar(existingId: string | null): Promise<string | null> {
  try {
    const all = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
    if (existingId && all.some((c) => c.id === existingId)) return existingId;
    const found = all.find((c) => c.title === NAME && c.allowsModifications);
    if (found) return found.id;
    const base = { title: NAME, color: "#2a7de1", entityType: Cal.EntityTypes.EVENT, name: "iq-academy", accessLevel: Cal.CalendarAccessLevel.OWNER };
    if (Platform.OS === "ios") { const def = await Cal.getDefaultCalendarAsync(); return await Cal.createCalendarAsync({ ...base, sourceId: def.source.id }); }
    return await Cal.createCalendarAsync({ ...base, ownerAccount: "personal", source: { isLocalAccount: true, name: NAME, type: Cal.SourceType.LOCAL } as Cal.Source });
  } catch { return null; }
}

const details = (s: EventSpec) => ({
  title: s.title, startDate: new Date(s.startMs), endDate: new Date(s.endMs), location: s.location, notes: s.notes, timeZone: "Africa/Lagos",
  alarms: [{ relativeOffset: -60 }], availability: Cal.Availability.BUSY,
});
export async function createEvent(calendarId: string, s: EventSpec): Promise<string | null> { try { return await Cal.createEventAsync(calendarId, details(s)); } catch { return null; } }
export async function updateEvent(eventId: string, s: EventSpec): Promise<boolean> { try { await Cal.updateEventAsync(eventId, details(s)); return true; } catch { return false; } }
/** An event the person already deleted by hand is not an error. */
export async function deleteEvent(eventId: string): Promise<void> { try { await Cal.deleteEventAsync(eventId); } catch { /* already gone */ } }
export async function deleteCalendar(calendarId: string): Promise<void> { try { await Cal.deleteCalendarAsync(calendarId); } catch { /* already gone */ } }
