// Pure calendar maths for the date pickers. Works on "YYYY-MM-DD" strings (centre calendar dates), never on the phone's timezone.
import { addDays } from "./web/time";

/** Monday-first weeks of a month; days outside the month are null. `ym` is "YYYY-MM". */
export function monthGrid(ym: string): (string | null)[][] {
  const [y, m] = ym.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
/** "YYYY-MM" moved by n months. */
export const shiftMonth = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1, 12)); return t.toISOString().slice(0, 7); };
/** Whether an ISO date is inside [min, max] (either may be missing). Lexicographic compare is correct for ISO dates. */
export const inRange = (d: string, min?: string, max?: string) => (!min || d >= min) && (!max || d <= max);
export const splitWall = (v: string) => ({ date: v.slice(0, 10), time: v.length >= 16 ? v.slice(11, 16) : "" });
export const joinWall = (date: string, time: string) => `${date}T${time || "00:00"}`;
export { addDays };
