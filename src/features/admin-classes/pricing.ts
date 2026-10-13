// The instalments are the PARTS of the full price (they must add up to it). The "extra fee" for paying in parts is added to the LAST instalment and belongs to
// IQ Academy only: instructors and centres do not earn from it.
// Pure rules for the Prices screen (port of the logic at the top of web pages/Prices.tsx). The database enforces the same rules; these give live feedback before a save.
export type InstRow = { label: string; amount: string; rule: string };
export type PackageForm = { id: string; code: string; name: string; description: string; courses: string; weeks: string; price: string; fee: string; active: boolean; instOn: boolean; inst: InstRow[] };

export const MAX_INST = 6;
export const digits = (s: string) => s.replace(/\D/g, "");
export const toKobo = (n: string | number) => Math.round(Number(n || 0) * 100);
// due rules: instalment 1 is always "before_start"; later ones lock a course from that course onward, or just remind.
export const ruleNo = (r: string) => (r.startsWith("before_course_") ? Number(r.slice(14)) : 0);
export const ruleText = (r: string) => (r === "before_start" ? "Before classes start" : r === "custom" ? "Reminder only (doesn't lock classes)" : `Before course ${ruleNo(r)} starts`);
export const blankPackage: PackageForm = { id: "", code: "", name: "", description: "", courses: "2", weeks: "", price: "", fee: "", active: true, instOn: false, inst: [] };

/** What the student is charged for each instalment, in naira: the parts, with the extra fee on the last one. */
export const chargedAmounts = (rows: Pick<InstRow, "amount">[], fee: string | number): number[] => rows.map((r, i) => (Number(r.amount) || 0) + (i === rows.length - 1 ? Number(fee) || 0 : 0));
/** The stored (charged) amounts back to editable parts: the extra fee comes off the last instalment. Amounts and fee are in kobo; result is naira text. */
export const partsFromCharged = (chargedKobo: number[], feeKobo: number): string[] => chargedKobo.map((a, i) => String((a - (i === chargedKobo.length - 1 ? feeKobo : 0)) / 100));

/** Split a whole-naira price over n instalments; the first one takes any remainder. */
export const split = (price: number, n: number) => { const base = Math.floor(price / n); return Array.from({ length: n }, (_, i) => String(i === 0 ? price - base * (n - 1) : base)); };
export const defaultRows = (price: string, courses: number): InstRow[] => {
  const p = Number(price || 0); const a = p > 0 ? split(p, 2) : ["", ""];
  return [
    { label: "First instalment (before classes start)", amount: a[0], rule: "before_start" },
    { label: "Second instalment (before second course)", amount: a[1], rule: courses >= 2 ? "before_course_2" : "custom" },
  ];
};
export const nextRule = (rows: InstRow[], courses: number) => { const next = Math.max(1, ...rows.map((r) => ruleNo(r.rule))) + 1; return next <= Math.min(courses, 4) ? `before_course_${next}` : "custom"; };

export function packageProblems(f: PackageForm, courseMax: number): string[] {
  const problems: string[] = []; const courseN = Number(f.courses); const priceN = Number(f.price);
  if (!f.name.trim()) problems.push("Give the package a name.");
  if (!f.id && !/^[A-Za-z0-9_-]{2,20}$/.test(f.code.trim())) problems.push("Add a short code (2–20 letters or numbers).");
  if (!(priceN > 0)) problems.push("Set a full price above ₦0.");
  if (!(courseN >= 1 && courseN <= courseMax)) problems.push(`Courses must be between 1 and ${courseMax}.`);
  if (f.weeks && Number(f.weeks) < 1) problems.push("Weeks must be at least 1.");
  if (f.instOn) {
    const total = f.inst.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (total > 0 && priceN > 0 && total !== priceN) problems.push(`The instalments must add up to the full price (₦${priceN.toLocaleString("en-NG")}). They add up to ₦${total.toLocaleString("en-NG")}.`);
    if (f.fee && !(Number(f.fee) >= 0)) problems.push("The extra fee must be ₦0 or more.");
    let prev = 0;
    f.inst.forEach((r, i) => {
      const n = i + 1; const k = ruleNo(r.rule);
      if (!r.label.trim()) problems.push(`Instalment ${n} needs a name.`);
      if (!(Number(r.amount) > 0)) problems.push(`Instalment ${n} needs an amount above ₦0.`);
      if (i > 0 && k) {
        if (k > courseN) problems.push(`Instalment ${n} is due before course ${k}, but this pack has ${courseN} course${courseN === 1 ? "" : "s"}.`);
        else if (k < prev) problems.push(`Instalment ${n} is due before an earlier one. Put them in order.`);
        prev = Math.max(prev, k);
      }
    });
  }
  return problems;
}
