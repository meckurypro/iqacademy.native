import { WINDOW_DAYS, type CalClass } from "@/features/calendar/plan";
import { getCal, resetCal, setCal } from "@/features/calendar/store";
import { disableCalendar, syncCalendar } from "@/features/calendar/sync";

const mockNative = jest.requireMock("@/native/calendar") as Record<string, jest.Mock>;

jest.mock("@/native/calendar", () => ({
  ensurePermission: jest.fn(async () => true), ensureCalendar: jest.fn(async (id: string | null) => id ?? "cal-1"),
  createEvent: jest.fn(async () => "ev-" + Math.random().toString(36).slice(2, 8)), updateEvent: jest.fn(async () => true),
  deleteEvent: jest.fn(async () => undefined), deleteCalendar: jest.fn(async () => undefined),
}));

const NOW = Date.parse("2026-10-12T09:00:00Z"); const H = 3600_000, D = 24 * H;
const cls = (id: string, startMs: number, over: Partial<CalClass> = {}): CalClass => ({ id, start_at: new Date(startMs).toISOString(), end_at: new Date(startMs + 2 * H).toISOString(), status: "scheduled", course_title: "Web", lesson_title: "HTML", centre_name: "Yaba", centre_city: "Lagos", centre_address: null, room: null, ...over });

beforeEach(() => { jest.clearAllMocks(); resetCal(); mockNative.ensurePermission.mockResolvedValue(true); mockNative.updateEvent.mockResolvedValue(true); });

describe("calendar sync, applied to the device", () => {
  it("does nothing while the switch is off", async () => {
    expect(await syncCalendar([cls("a", NOW + D)], false, NOW)).toEqual({ ok: false, reason: "off" }); expect(mockNative.createEvent).not.toHaveBeenCalled();
  });
  it("stops with a clear reason when calendar access is refused", async () => {
    setCal({ enabled: true }); mockNative.ensurePermission.mockResolvedValue(false);
    expect(await syncCalendar([cls("a", NOW + D)], false, NOW)).toEqual({ ok: false, reason: "permission" }); expect(mockNative.createEvent).not.toHaveBeenCalled();
  });
  it("creates events, remembers them, then leaves an unchanged calendar alone", async () => {
    setCal({ enabled: true });
    expect(await syncCalendar([cls("a", NOW + D), cls("b", NOW + 2 * D)], false, NOW)).toEqual({ ok: true, created: 2, updated: 0, removed: 0 });
    expect(Object.keys(getCal().map).sort()).toEqual(["a", "b"]); expect(getCal().calendarId).toBe("cal-1");
    expect(await syncCalendar([cls("a", NOW + D), cls("b", NOW + 2 * D)], false, NOW)).toEqual({ ok: true, created: 0, updated: 0, removed: 0 });
    expect(mockNative.createEvent).toHaveBeenCalledTimes(2);
  });
  it("moves an event when the class moves, and puts it back if the person deleted it by hand", async () => {
    setCal({ enabled: true }); await syncCalendar([cls("a", NOW + D)], false, NOW);
    expect((await syncCalendar([cls("a", NOW + D + H)], false, NOW))).toMatchObject({ updated: 1 }); expect(mockNative.updateEvent).toHaveBeenCalledTimes(1);
    mockNative.updateEvent.mockResolvedValue(false); mockNative.createEvent.mockClear();
    expect(await syncCalendar([cls("a", NOW + D + 2 * H)], false, NOW)).toMatchObject({ updated: 1 }); expect(mockNative.createEvent).toHaveBeenCalledTimes(1);
  });
  it("removes the event of a class that was cancelled, but not events beyond a cut-off list", async () => {
    setCal({ enabled: true }); await syncCalendar([cls("a", NOW + D), cls("late", NOW + (WINDOW_DAYS - 1) * D)], false, NOW);
    expect(await syncCalendar([cls("a", NOW + D, { status: "cancelled" })], true, NOW)).toMatchObject({ removed: 1 }); // "late" is after the last class we were sent: kept
    expect(mockNative.deleteEvent).toHaveBeenCalledTimes(1); expect(Object.keys(getCal().map)).toEqual(["late"]);
  });
  it("starts fresh if the person deleted the whole IQ Academy calendar", async () => {
    setCal({ enabled: true }); await syncCalendar([cls("a", NOW + D)], false, NOW);
    mockNative.ensureCalendar.mockResolvedValueOnce("cal-2"); mockNative.createEvent.mockClear();
    expect(await syncCalendar([cls("a", NOW + D)], false, NOW)).toMatchObject({ created: 1 }); expect(getCal().calendarId).toBe("cal-2");
  });
  it("turning it off can remove everything it added, or keep what is there", async () => {
    setCal({ enabled: true }); await syncCalendar([cls("a", NOW + D)], false, NOW);
    await disableCalendar(false); expect(getCal()).toMatchObject({ enabled: false, calendarId: "cal-1" }); expect(mockNative.deleteCalendar).not.toHaveBeenCalled();
    setCal({ enabled: true }); await disableCalendar(true); // sign-out does this
    expect(mockNative.deleteCalendar).toHaveBeenCalledWith("cal-1"); expect(getCal()).toEqual({ enabled: false, calendarId: null, map: {}, lastSyncAt: null });
  });
});
