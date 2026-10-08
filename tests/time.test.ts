import { __forceTzStrategy, addDays, addMonths, dayOf, dayStart, fmtClock, fmtDay, fmtWhen, fromWallInput, mondayOf, monthStart, relativeDay, setClockSkew, toWallInput, today, tzStrategy } from "@/shared/web/time";

// Reference: the engine's own Africa/Lagos data (Node ships full ICU). Lagos is UTC+1 all year, no DST.
const ref = (o: Intl.DateTimeFormatOptions, locale?: string) => new Intl.DateTimeFormat(locale, { timeZone: "Africa/Lagos", ...o });
const INSTANTS = [
  Date.UTC(2026, 0, 1, 0, 30),        // Lagos 01:30 same day
  Date.UTC(2026, 9, 4, 23, 30),       // Lagos 00:30 NEXT day: the day-boundary case that matters
  Date.UTC(2026, 11, 31, 23, 59, 59), // new year in Lagos
  Date.UTC(2026, 2, 29, 12, 0),       // European DST changeover day: must not matter
  Date.UTC(2026, 5, 15, 8, 5),
];

describe.each(["intl", "shifted"] as const)("time (%s strategy)", (mode) => {
  beforeAll(() => { __forceTzStrategy(mode); });
  afterAll(() => { __forceTzStrategy(null); });

  it("shows clock times in Lagos whatever the phone's zone is", () => {
    for (const t of INSTANTS) expect(fmtClock(t)).toBe(ref({ hour: "numeric", minute: "2-digit" }).format(t));
  });
  it("formats moments with options in Lagos", () => {
    const o = { weekday: "short", day: "numeric", month: "short" } as const;
    for (const t of INSTANTS) expect(fmtWhen(t, o)).toBe(ref(o).format(t));
  });
  it("gives the centre-time calendar date (en-CA, YYYY-MM-DD)", () => {
    for (const t of INSTANTS) expect(dayOf(t)).toBe(ref({ year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA").format(t));
    expect(dayOf(Date.UTC(2026, 9, 4, 23, 30))).toBe("2026-10-05");
  });
  it("round-trips wall-clock input without involving the phone's zone", () => {
    for (const t of INSTANTS) {
      const w = toWallInput(t);
      expect(w).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(fromWallInput(w)).toBe(Math.floor(t / 60000) * 60000);
    }
    expect(fromWallInput("2026-10-05T09:00")).toBe(Date.parse("2026-10-05T09:00:00+01:00"));
    expect(Number.isNaN(fromWallInput("nope"))).toBe(true);
  });
  it("finds the start of a centre day", () => {
    expect(dayStart("2026-10-05")).toBe(Date.parse("2026-10-05T00:00:00+01:00"));
  });
  it("relative day uses the server-corrected clock", () => {
    const real = Date.now; Date.now = () => Date.UTC(2026, 9, 5, 10, 0); setClockSkew(0);
    try {
      expect(today()).toBe("2026-10-05");
      expect(relativeDay(Date.UTC(2026, 9, 5, 9, 0), { day: "numeric", month: "short" })).toBe("Today");
      expect(relativeDay(Date.UTC(2026, 9, 4, 12, 0), { day: "numeric", month: "short" })).toBe("Yesterday");
      expect(relativeDay(Date.UTC(2026, 9, 6, 12, 0), { day: "numeric", month: "short" })).toBe("Tomorrow");
      setClockSkew(2 * 3600 * 1000); // phone two hours behind the server: it is already Oct 5 12:00 Lagos... still today
      expect(today()).toBe("2026-10-05");
      setClockSkew(14 * 3600 * 1000); // server far ahead: next day at the centre
      expect(today()).toBe("2026-10-06");
    } finally { Date.now = real; setClockSkew(0); }
  });
});

describe("plain calendar dates never shift", () => {
  it("fmtDay / addDays / addMonths / mondayOf / monthStart", () => {
    expect(fmtDay("2026-10-05", { day: "numeric", month: "short" })).toBe(new Intl.DateTimeFormat(undefined, { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date("2026-10-05T12:00:00Z")));
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(mondayOf("2026-10-07")).toBe("2026-10-05"); // 7 Oct 2026 is a Wednesday
    expect(mondayOf("2026-10-04")).toBe("2026-09-28"); // Sunday belongs to the week before
    expect(monthStart("2026-10-17")).toBe("2026-10-01");
  });
});

describe("strategy detection", () => {
  it("reports a strategy and Node supports Lagos natively", () => { __forceTzStrategy(null); expect(tzStrategy()).toBe("intl"); });
});
