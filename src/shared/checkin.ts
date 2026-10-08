// PORT-OF web src/lib/checkin.ts @0081e66 — types, wording and door window only. The `useCheckedIn` hook belongs to M7a.
import { fmtClock, now } from "./web/time";
import { CHECKIN_OPENS_MIN, DENIED, REASON_LABEL } from "./web/consts";

export { CHECKIN_OPENS_MIN, DENIED, REASON_LABEL };

export type Verdict = {
  ok: boolean;
  reason?: "not_enrolled" | "not_invited" | "payment_required" | "makeup_not_open" | "not_a_missed_class" | "makeup_limit_reached";
  already_checked_in?: boolean; makeup?: boolean; emergency?: boolean;
  session_id?: string; first_name?: string | null; course_title?: string | null; lesson_title?: string | null; centre_name?: string | null;
};

export const deniedText = (reason?: string) => DENIED[reason ?? ""] ?? { title: "Not allowed in", detail: "You can't join this class." };

export type DoorState = "early" | "open" | "ended";
export function doorState(start: string, end: string, at = now()): DoorState {
  if (at < Date.parse(start) - CHECKIN_OPENS_MIN * 60000) return "early";
  if (at > Date.parse(end)) return "ended";
  return "open";
}
export const opensAt = (start: string) => fmtClock(Date.parse(start) - CHECKIN_OPENS_MIN * 60000);
