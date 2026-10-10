import { FETCH_LIMIT, WINDOW_DAYS, eventLocation, eventTitle, planSync, signature, type CalClass, type Mapped } from "@/features/calendar/plan";
import { parseCalState } from "@/features/calendar/store";

const NOW = Date.parse("2026-10-12T09:00:00Z"); const H = 3600_000, D = 24 * H;
const cls = (id: string, startMs: number, over: Partial<CalClass> = {}): CalClass => ({
  id, start_at: new Date(startMs).toISOString(), end_at: new Date(startMs + 2 * H).toISOString(), status: "scheduled", course_title: "Web", lesson_title: "HTML", centre_name: "Yaba", centre_city: "Lagos", centre_address: "12 Herbert Macaulay Way", room: null, ...over,
});
const mapOf = (c: CalClass, eventId = "e-" + c.id): Mapped => ({ eventId, sig: signature(c), startMs: Date.parse(c.start_at) });

describe("calendar sync plan", () => {
  it("creates events for new upcoming classes and nothing else on a settled calendar", () => {
    const a = cls("a", NOW + D), b = cls("b", NOW + 2 * D);
    expect(planSync([a, b], {}, NOW).create.map((c) => c.id)).toEqual(["a", "b"]);
    expect(planSync([a, b], { a: mapOf(a), b: mapOf(b) }, NOW)).toEqual({ create: [], update: [], remove: [], forget: [] });
  });
  it("updates only when something shown changed (time, title or place)", () => {
    const a = cls("a", NOW + D); const m = { a: mapOf(a) };
    expect(planSync([cls("a", NOW + D + H)], m, NOW).update).toHaveLength(1);
    expect(planSync([cls("a", NOW + D, { lesson_title: "CSS" })], m, NOW).update).toHaveLength(1);
    expect(planSync([cls("a", NOW + D, { room: "Lab 2" })], m, NOW).update[0].eventId).toBe("e-a");
  });
  it("removes a cancelled or vanished class that is still in the future, keeps the event of one that already happened", () => {
    const a = cls("a", NOW + D), old = cls("old", NOW - 3 * D);
    const p = planSync([cls("a", NOW + D, { status: "cancelled" })], { a: mapOf(a), old: mapOf(old) }, NOW);
    expect(p.remove).toEqual([{ id: "a", eventId: "e-a" }]); expect(p.forget).toEqual(["old"]);
  });
  it("skips classes already over, cancelled, or beyond the window", () => {
    const p = planSync([cls("over", NOW - 5 * H), cls("x", NOW + D, { status: "cancelled" }), cls("far", NOW + (WINDOW_DAYS + 1) * D), cls("live", NOW - H)], {}, NOW);
    expect(p.create.map((c) => c.id)).toEqual(["live"]); // started an hour ago, ends in an hour
  });
  it("never removes events beyond a cut-off list", () => {
    const page = Array.from({ length: FETCH_LIMIT }, (_, i) => cls("c" + i, NOW + (i + 1) * 8 * H));
    const late = cls("late", NOW + 25 * D); const lastStart = Date.parse(page[page.length - 1].start_at);
    expect(late.start_at > page[page.length - 1].start_at).toBe(true); expect(Date.parse(late.start_at)).toBeGreaterThan(lastStart);
    expect(planSync(page, { late: mapOf(late) }, NOW, true).remove).toEqual([]);   // may exist, just not sent
    expect(planSync(page, { late: mapOf(late) }, NOW, false).remove).toHaveLength(1); // a complete list really lacks it
  });
  it("words the event without any clock time", () => {
    const c = cls("a", NOW + D); expect(eventTitle(c)).toBe("Web: HTML"); expect(eventTitle(cls("a", NOW, { lesson_title: null }))).toBe("Web");
    expect(eventLocation(c)).toBe("Yaba, 12 Herbert Macaulay Way"); expect(eventTitle(c)).not.toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("saved calendar state", () => {
  it("falls back to off when storage is damaged, and drops malformed entries", () => {
    expect(parseCalState(null)).toEqual({ enabled: false, calendarId: null, map: {}, lastSyncAt: null });
    expect(parseCalState({ enabled: "yes", map: { a: { eventId: 1 }, b: { eventId: "e", sig: "s", startMs: 5 } } })).toEqual({ enabled: false, calendarId: null, map: { b: { eventId: "e", sig: "s", startMs: 5 } }, lastSyncAt: null });
  });
});
