import { UserMessage } from "@/core/errors";
import { canContinue, dueNow, emptySel, later, missingFor, selKey, sortCentres, sortInstalments, startsLabel, toggleCourse, when, type Course, type Pack, type Pre } from "@/features/enrol/logic";
import { checkResized, fitWithin, guessMime, passThroughOk, planReceipt } from "@/features/enrol/receipt";

const c = (id: string, title = id.toUpperCase()): Course => ({ id, title, summary: null, sort_order: 0 });
const courses = [c("a", "Basics"), c("b", "Build"), c("c", "Automate"), c("d", "Ship")];
// b needs a; c needs (a or b); d needs c
const pres: Pre[] = [
  { course_id: "b", prerequisite_id: "a", group_no: 1 },
  { course_id: "c", prerequisite_id: "a", group_no: 1 }, { course_id: "c", prerequisite_id: "b", group_no: 1 },
  { course_id: "d", prerequisite_id: "c", group_no: 1 },
];
const none = new Set<string>();
const title = (id: string) => courses.find((x) => x.id === id)?.title ?? "";

describe("prerequisites", () => {
  it("names what is missing, 'or' within a group", () => {
    expect(missingFor(courses[1], [], pres, none, title)).toBe("Basics");
    expect(missingFor(courses[2], [], pres, none, title)).toBe("Basics or Build");
    expect(missingFor(courses[0], [], pres, none, title)).toBeNull();
  });
  it("completed courses and the current selection both count", () => {
    expect(missingFor(courses[1], [], pres, new Set(["a"]), title)).toBeNull();
    expect(missingFor(courses[1], ["a"], pres, none, title)).toBeNull();
  });
  it("unticking a course drops everything that depended on it, down the whole chain", () => {
    expect(toggleCourse(["a", "b", "c", "d"], courses[0], courses, pres, none)).toEqual([]);          // a gone → b, c, d all fall
    expect(toggleCourse(["a", "b", "c", "d"], courses[1], courses, pres, none)).toEqual(["a", "c", "d"]); // c still has a
    expect(toggleCourse(["a", "b"], courses[0], courses, pres, new Set(["a"]))).toEqual(["b"]);        // a was already completed
  });
  it("a course cannot be ticked before its prerequisite", () => {
    expect(toggleCourse([], courses[1], courses, pres, none)).toEqual([]);
    expect(toggleCourse(["a"], courses[1], courses, pres, none)).toEqual(["a", "b"]);
  });
});

const pack: Pack = { id: "p", name: "Pack", description: null, course_count: 2, price_full: 10_000_000,
  package_instalments: [{ number: 2, label: "Second", amount: 4_000_000, due_rule: "before_course_2" }, { number: 1, label: "First", amount: 6_000_000, due_rule: "now" }] };
describe("money and plans", () => {
  it("orders instalments and states what is due now", () => {
    const inst = sortInstalments(pack);
    expect(inst.map((i) => i.number)).toEqual([1, 2]);
    expect(dueNow("full", pack, inst)).toBe(10_000_000);
    expect(dueNow("instalment", pack, inst)).toBe(6_000_000);
    expect(dueNow("full", undefined, [])).toBe(0);
  });
  it("words the later payments", () => {
    expect(when(pack.package_instalments[0])).toBe("₦40,000 before course 2");
    expect(when({ amount: 100_000, label: "Final", due_rule: "date" })).toBe("₦1,000 (Final)");
    expect(later(sortInstalments(pack))).toBe("Then ₦40,000 before course 2");
    expect(later([pack.package_instalments[1]])).toBeUndefined();
  });
});

describe("steps", () => {
  const sel = { ...emptySel(), pack: "p", courses: ["a", "b"], centre: "x" };
  it("each step needs its own choice", () => {
    expect(canContinue(0, emptySel(), undefined, undefined)).toBe(false);
    expect(canContinue(0, sel, pack, undefined)).toBe(true);
    expect(canContinue(1, { ...sel, courses: ["a"] }, pack, undefined)).toBe(false); // pack wants 2
    expect(canContinue(1, sel, pack, undefined)).toBe(true);
    expect(canContinue(2, sel, pack, new Map())).toBe(false);                      // centre with no class date
    expect(canContinue(2, sel, pack, new Map([["x", "2026-11-02"]]))).toBe(true);
    expect(canContinue(3, emptySel(), undefined, undefined)).toBe(true);
  });
  it("centres with dates first, earliest first, then by town", () => {
    const cs = [{ id: "1", name: "Z", city: "Zaria", address: null }, { id: "2", name: "A", city: "Abuja", address: null }, { id: "3", name: "L", city: "Lagos", address: null }];
    expect(sortCentres(cs, new Map([["3", "2026-11-09"], ["1", "2026-11-02"]])).map((x) => x.id)).toEqual(["1", "3", "2"]);
  });
  it("a retry with the same choices reuses the registration; changing a choice does not", () => {
    const k = selKey({ ...emptySel(), pack: "p", courses: ["b", "a"], centre: "x" }, "online");
    expect(selKey({ ...emptySel(), pack: "p", courses: ["a", "b"], centre: "x" }, "online")).toBe(k);
    expect(selKey({ ...emptySel(), pack: "p", courses: ["a", "b"], centre: "y" }, "online")).not.toBe(k);
    expect(selKey({ ...emptySel(), pack: "p", courses: ["a", "b"], centre: "x" }, "offline")).not.toBe(k);
  });
  it("labels a start date", () => {
    expect(startsLabel("2026-10-01", "2026-10-10")).toBe("Starts today");
    expect(startsLabel("2026-10-10", "2026-10-10")).toBe("Starts today");
    expect(startsLabel("2026-11-02", "2026-10-10")).toMatch(/^Starts .*November.*2026/); // word order comes from the engine's locale (Hermes: spike S1)
  });
});

describe("receipts", () => {
  const msg = (f: () => unknown) => { try { f(); return null; } catch (e) { return e instanceof UserMessage ? e.message : String(e); } };
  it("PDFs pass up to 5 MB, larger ones are refused with the web's wording", () => {
    expect(planReceipt("application/pdf", "r.pdf", 1000)).toEqual({ action: "pdf" });
    expect(msg(() => planReceipt("application/pdf", "r.pdf", 6 * 1024 * 1024))).toMatch(/over 5 MB/);
  });
  it("photos are resized; other types are refused; the extension is used when the picker gave no type", () => {
    expect(planReceipt("image/heic", "p.heic", 3_000_000)).toEqual({ action: "resize" });
    expect(planReceipt("", "scan.PDF", 10)).toEqual({ action: "pdf" });
    expect(planReceipt(null, "x.jpg", 10)).toEqual({ action: "resize" });
    expect(msg(() => planReceipt("application/zip", "a.zip", 10))).toMatch(/JPG, PNG\) or a PDF/);
    expect(msg(() => planReceipt("", "noext", 10))).toMatch(/JPG, PNG\) or a PDF/);
  });
  it("shrinks the longer side to 1600 and never enlarges", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("refuses a result that is still too large or empty; passes through only accepted, small files", () => {
    expect(msg(() => checkResized(6 * 1024 * 1024))).toMatch(/too large/);
    expect(msg(() => checkResized(0))).toMatch(/couldn't read/);
    expect(msg(() => checkResized(900_000))).toBeNull();
    expect(passThroughOk("image/png", 1000)).toBe(true);
    expect(passThroughOk("image/heic", 1000)).toBe(false);
    expect(passThroughOk("image/png", 9 * 1024 * 1024)).toBe(false);
    expect(guessMime("A.JPEG")).toBe("image/jpeg");
  });
});
