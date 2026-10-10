import { blankRow, essence, hasText, same, withKey, type Snapshot } from "@/features/admin-classes/courseDiff";
import { blankPackage, defaultRows, nextRule, packageProblems, ruleNo, ruleText, split, toKobo, type PackageForm } from "@/features/admin-classes/pricing";

describe("instalment maths (Prices)", () => {
  it("splits a price so the pieces add up and the first takes the remainder", () => {
    expect(split(100000, 2)).toEqual(["50000", "50000"]);
    expect(split(100001, 3)).toEqual(["33335", "33333", "33333"]);
    expect(split(100001, 3).reduce((n, x) => n + Number(x), 0)).toBe(100001);
  });
  it("converts naira text to kobo without float drift", () => { expect(toKobo("150000")).toBe(15000000); expect(toKobo("")).toBe(0); expect(toKobo("19.99")).toBe(1999); });
  it("reads due rules", () => {
    expect(ruleNo("before_course_3")).toBe(3); expect(ruleNo("custom")).toBe(0); expect(ruleNo("before_start")).toBe(0);
    expect(ruleText("before_course_2")).toBe("Before course 2 starts"); expect(ruleText("before_start")).toBe("Before classes start");
  });
  it("starts with two rows, the second tied to course 2 only when the pack has one", () => {
    expect(defaultRows("100000", 3).map((r) => r.rule)).toEqual(["before_start", "before_course_2"]);
    expect(defaultRows("100000", 1)[1].rule).toBe("custom"); expect(defaultRows("", 2).map((r) => r.amount)).toEqual(["", ""]);
  });
  it("picks the next course rule, falling back to reminder-only past course 4 or the pack size", () => {
    const rows = defaultRows("100", 4); expect(nextRule(rows, 4)).toBe("before_course_3");
    expect(nextRule([...rows, { label: "x", amount: "1", rule: "before_course_4" }], 4)).toBe("custom"); expect(nextRule(rows, 2)).toBe("custom");
  });
});

describe("package checks", () => {
  const good: PackageForm = { ...blankPackage, name: "Standard", code: "STD", price: "300000", courses: "3", instOn: true, inst: [{ label: "First", amount: "150000", rule: "before_start" }, { label: "Second", amount: "150000", rule: "before_course_2" }] };
  it("accepts a sound package", () => expect(packageProblems(good, 10)).toEqual([]));
  it("asks for what is missing", () => {
    const p = packageProblems({ ...blankPackage }, 10);
    expect(p).toEqual(expect.arrayContaining(["Give the package a name.", "Add a short code (2–20 letters or numbers).", "Set a full price above ₦0."]));
  });
  it("does not ask for a code when editing, and bounds the course count", () => {
    expect(packageProblems({ ...good, id: "x", code: "" }, 10)).toEqual([]);
    expect(packageProblems({ ...good, courses: "11" }, 10)).toContain("Courses must be between 1 and 10.");
  });
  it("catches an instalment due before a course the pack doesn't have, and one out of order", () => {
    const late = { ...good, courses: "2", inst: [good.inst[0], { label: "B", amount: "1", rule: "before_course_3" }] };
    expect(packageProblems(late, 10).some((x) => x.includes("due before course 3"))).toBe(true);
    const order = { ...good, courses: "4", inst: [good.inst[0], { label: "B", amount: "1", rule: "before_course_3" }, { label: "C", amount: "1", rule: "before_course_2" }] };
    expect(packageProblems(order, 10).some((x) => x.includes("before an earlier one"))).toBe(true);
  });
});

describe("course comparison (Course builder)", () => {
  const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ details: { code: "WEB", title: "Web", summary: "S", active: true }, rows: [withKey("A", "a"), withKey("B", "b")], groups: [["x", "y"]], ...over });
  it("ignores row keys, surrounding spaces and the order inside a requirement", () => {
    const a = snap(); const b = snap({ rows: [withKey(" A ", "a"), withKey("B", " b")], groups: [["y", "x"]] });
    expect(same(a, b)).toBe(true); expect(essence(a)).toBe(essence(b));
  });
  it("sees real changes: topic, order, visibility, requirements", () => {
    const a = snap();
    expect(same(a, snap({ rows: [withKey("B", "b"), withKey("A", "a")] }))).toBe(false);
    expect(same(a, snap({ details: { ...a.details, active: false } }))).toBe(false);
    expect(same(a, snap({ groups: [] }))).toBe(false);
  });
  it("treats an empty requirement as no requirement, and knows blank rows", () => {
    expect(same(snap({ groups: [] }), snap({ groups: [[]] }))).toBe(true);
    expect(hasText(blankRow())).toBe(false); expect(hasText(withKey("", "notes"))).toBe(true);
  });
});
