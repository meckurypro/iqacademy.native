import { noteLink, reminderTitle, when } from "@/features/notifications/format";

const START = Date.parse("2026-10-12T09:00:00Z"); const min = 60_000;
const n = (type: string, start: number | null = START, title = "Class soon") => ({ type, title, data: start == null ? null : { start_at: new Date(start).toISOString() } });

describe("class reminder headlines are worked out when read, not when sent", () => {
  it("counts down from the class's own start time", () => {
    expect(reminderTitle(n("class_reminder"), START - 3 * 60 * min)).toBe("Class in 3 hours");
    expect(reminderTitle(n("class_reminder"), START - 60 * min)).toBe("Class in 1 hour");
    expect(reminderTitle(n("class_reminder"), START - 4 * min)).toBe("Class in 4 minutes");
    expect(reminderTitle(n("class_reminder"), START - 30_000)).toBe("Class starts now");
  });
  it("then says how long ago it started", () => {
    expect(reminderTitle(n("class_reminder"), START + 20_000)).toBe("Class has started");
    expect(reminderTitle(n("class_reminder"), START + 12 * min)).toBe("Class started 12 min ago");
    expect(reminderTitle(n("class_reminder"), START + 5 * 60 * min)).toMatch(/class$/);
  });
  it("staff reminders say where; other types and missing times keep the sent title", () => {
    expect(reminderTitle(n("class_reminder_staff"), START - 4 * min)).toBe("Class in 4 minutes at your centre");
    expect(reminderTitle(n("announcement", START, "Holiday"), START - 4 * min)).toBe("Holiday");
    expect(reminderTitle(n("class_reminder", null, "Sent title"), START)).toBe("Sent title");
  });
});

describe("when", () => {
  const at = Date.parse("2026-10-12T12:00:00Z");
  it("says just now / minutes ago", () => {
    expect(when(new Date(at - 20_000).toISOString(), at)).toBe("Just now");
    expect(when(new Date(at - 7 * min).toISOString(), at)).toBe("7 min ago");
  });
});

describe("links", () => {
  it("maps types to where they lead", () => {
    expect(noteLink("run_started")).toEqual({ to: "/schedule", label: "Open schedule" });
    expect(noteLink("run_cancelled")).toBeNull();
    expect(noteLink("class_assigned")?.to).toBe("/my-classes");
    expect(noteLink("custom_class_invite")?.to).toBe("/");
    expect(noteLink("announcement")).toBeNull();
  });
});
