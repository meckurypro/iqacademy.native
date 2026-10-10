// Pure helpers for the Course builder (port of the top of web pages/CourseBuilder.tsx): what matters when comparing "on screen" with "in the database".
export type Row = { k: number; title: string; description: string };
export type Details = { code: string; title: string; summary: string; active: boolean };
export type Snapshot = { details: Details; rows: Row[]; groups: string[][] };
export const MAX_CLASSES = 40;

let keySeq = 0;
export const blankRow = (): Row => ({ k: ++keySeq, title: "", description: "" });
export const withKey = (title: string, description: string): Row => ({ k: ++keySeq, title, description });
export const hasText = (r: Row) => !!(r.title.trim() || r.description.trim());

export const essence = (s: Snapshot) => JSON.stringify({
  t: s.details.title.trim(), s: s.details.summary.trim(), a: s.details.active,
  l: s.rows.map((r) => [r.title.trim(), r.description.trim()]),
  p: s.groups.filter((g) => g.length).map((g) => [...g].sort().join(",")).sort(),
});
export const same = (a: Snapshot, b: Snapshot) => essence(a) === essence(b);
