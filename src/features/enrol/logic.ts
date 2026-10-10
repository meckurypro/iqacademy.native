// Pure rules of the enrol flow (no React, no native modules), so they are unit-tested. PORT-OF web src/pages/Enrol.tsx @d14323f.
import { naira } from "@/shared/format";
import { place } from "@/shared/web/centre";
import { fmtDay, today } from "@/shared/web/time";

export type Centre = { id: string; name: string; address: string | null; city: string | null };
export type Start = { centre_id: string; starts_on: string };
export type Instalment = { number: number; label: string; amount: number; due_rule: string };
export type Pack = { id: string; name: string; description: string | null; course_count: number; price_full: number; package_instalments: Instalment[] };
export type Course = { id: string; title: string; summary: string | null; sort_order: number };
export type Pre = { course_id: string; prerequisite_id: string; group_no: number };
export const STEPS = ["Pack", "Courses", "Centre", "Payment"] as const;

export type Sel = { pack: string; courses: string[]; centre: string; plan: "full" | "instalment" };
export const emptySel = (): Sel => ({ pack: "", courses: [], centre: "", plan: "full" });

/** "Then ₦40,000 before course 2": the first instalment is the amount due now, so only the rest need spelling out. */
export const when = (i: Pick<Instalment, "amount" | "label" | "due_rule">) => {
  const m = /^before_course_(\d)$/.exec(i.due_rule);
  return m ? `${naira(i.amount)} before course ${m[1]}` : `${naira(i.amount)} (${i.label})`;
};
export const later = (inst: Pick<Instalment, "amount" | "label" | "due_rule">[]) => (inst.length > 1 ? `Then ${inst.slice(1).map(when).join(" · ")}` : undefined);

export const startsLabel = (iso: string, todayIso = today()) => (iso <= todayIso ? "Starts today" : `Starts ${fmtDay(iso, { day: "numeric", month: "long", year: "numeric" })}`);

export const sortInstalments = (p: Pack | undefined) => [...(p?.package_instalments ?? [])].sort((a, b) => a.number - b.number);
export const dueNow = (plan: Sel["plan"], pack: Pack | undefined, inst: Instalment[]) => (plan === "full" ? pack?.price_full ?? 0 : inst[0]?.amount ?? 0);

/** What a course still needs before it can be picked: every prerequisite group must have a course that is completed or in this selection. Returns the missing titles ("A or B"), or null when available. */
export function missingFor(c: Course, chosen: string[], pres: Pre[], done: Set<string>, title: (id: string) => string): string | null {
  const groups = new Map<number, string[]>();
  pres.filter((p) => p.course_id === c.id).forEach((p) => groups.set(p.group_no, [...(groups.get(p.group_no) ?? []), p.prerequisite_id]));
  for (const ids of groups.values()) if (!ids.some((i) => done.has(i) || chosen.includes(i))) return ids.map(title).join(" or ");
  return null;
}

/** Tap on a course: add or remove it, then drop anything whose prerequisite just went away (a chain can be several deep, so repeat). */
export function toggleCourse(selected: string[], c: Course, courses: Course[], pres: Pre[], done: Set<string>): string[] {
  const title = (id: string) => courses.find((x) => x.id === id)?.title ?? "";
  let next = selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id];
  for (let i = 0; i < 4; i++) next = next.filter((id) => { const k = courses.find((x) => x.id === id); return !k || !missingFor(k, next.filter((y) => y !== id), pres, done, title); });
  return next;
}

/** Centres with a class date first (earliest first), then by town name. */
export const sortCentres = (centres: Centre[], starts: Map<string, string>) =>
  [...centres].sort((a, b) => (starts.get(a.id) ?? "9").localeCompare(starts.get(b.id) ?? "9") || place(a).localeCompare(place(b)));

/** Can the person go on from this step? */
export function canContinue(step: number, sel: Sel, pack: Pack | undefined, starts: Map<string, string> | undefined) {
  return [!!sel.pack, !!pack && sel.courses.length === pack.course_count, !!sel.centre && !!starts?.has(sel.centre), true][step] ?? false;
}

/** Same selection → same key, so a retry after a failed payment reuses the registration it already made instead of creating a second one. */
export const selKey = (s: Sel, method: string) => JSON.stringify([s.pack, [...s.courses].sort(), s.centre, s.plan, method]);
