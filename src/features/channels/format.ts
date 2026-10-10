// Class channel types and the small rules around them (port of web lib/messages.ts, pure parts). Tested without a phone.
import { fmtClock } from "@/shared/web/time";

export const BUCKET = "class-messages";
export const PAGE = 40;
export type ClassMessage = {
  id: string; session_id: string; sender_label: string; body: string | null;
  media_path: string | null; media_name: string | null; media_mime: string | null; media_size: number | null; created_at: string;
};

/** Students can select the text of a message only for this long after it arrives. */
export const COPY_SHARE_WINDOW_MS = 2 * 60 * 60 * 1000;
export const copyShareEndsAt = (m: Pick<ClassMessage, "created_at">) => Date.parse(m.created_at) + COPY_SHARE_WINDOW_MS;
/** True once the window has passed. `at` is the server-corrected time, so changing the phone's clock does not reopen it. */
export const copyShareClosed = (m: Pick<ClassMessage, "created_at">, at: number) => at >= copyShareEndsAt(m);
export const copyShareNote = (m: Pick<ClassMessage, "created_at">) => `Copy and share close 2 hours after a message arrives (${fmtClock(copyShareEndsAt(m))}).`;

export const mergeMessages = (a: ClassMessage[], b: ClassMessage[]) => {
  const m = new Map<string, ClassMessage>(); [...a, ...b].forEach((x) => m.set(x.id, x));
  return [...m.values()].sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
};
export const isImageMime = (mime: string | null | undefined) => !!mime && mime.startsWith("image/");
export const fileSize = (n: number | null) => !n ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

/** One refresh of a channel from its newest page. If that page is not full we are holding the whole channel, so it simply replaces what we had (that is how a
 *  deleted message disappears). Otherwise older pages already loaded are kept, and anything inside the newest page's time range that is no longer there is dropped. */
export function nextMessages(prev: ClassMessage[] | undefined, latest: ClassMessage[]): ClassMessage[] {
  const page = mergeMessages([], latest);
  if (!prev || latest.length < PAGE) return page;
  const from = Date.parse(page[0].created_at);
  return mergeMessages(prev.filter((m) => Date.parse(m.created_at) < from), page);
}

/** Where a day separator goes and whether a bubble starts a new run from the same sender. */
export function layoutFlags(msgs: ClassMessage[], i: number, day: (iso: string) => string) {
  const m = msgs[i], prev = i > 0 ? msgs[i - 1] : null;
  const newDay = !prev || day(m.created_at) !== day(prev.created_at);
  return { newDay, first: newDay || !prev || prev.sender_label !== m.sender_label };
}

export type PendingRow = { id: string; body: string | null; status: string; mediaName?: string | null };
/** The unsent messages of this chat, from the outbox, oldest first. */
export function pendingForSession(rows: { id: string; kind: string; status: string; created_at: number; payload: unknown }[], sessionId: string): PendingRow[] {
  return rows
    .filter((r) => {
      if (r.kind === "rpc") { const p = r.payload as { name?: string; args?: { p_session_id?: string } }; return p.name === "send_class_message" && p.args?.p_session_id === sessionId; }
      return false;
    })
    .sort((a, b) => a.created_at - b.created_at)
    .map((r) => ({ id: r.id, body: ((r.payload as { args?: { p_body?: string | null } }).args?.p_body) ?? null, status: r.status }));
}
