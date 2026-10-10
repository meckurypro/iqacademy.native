// Class channel types and the small rules around them (port of web lib/messages.ts, pure parts). Tested without a phone.
import { fmtClock } from "@/shared/web/time";

export const BUCKET = "class-messages";
export const PAGE = 40;
export type ClassMessage = {
  id: string; session_id: string; sender_label: string; body: string | null;
  media_path: string | null; media_name: string | null; media_mime: string | null; media_size: number | null; created_at: string;
  /** Returned by the channel RPC; used as the title when sharing. */
  course_title?: string | null;
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

export const MAX_SELECT = 20;
/** Tap on a message while selecting. Returns the new selection, or `refused` when the person is at the limit. */
export function toggleSelection(cur: ReadonlySet<string> | null, id: string, max = MAX_SELECT): { set: Set<string>; refused: boolean } {
  const n = new Set(cur ?? []);
  if (n.has(id)) { n.delete(id); return { set: n, refused: false }; }
  if (n.size >= max) return { set: n, refused: true };
  n.add(id); return { set: n, refused: false };
}
/** Students (restricted) may copy or share only inside the two-hour window; staff always may. */
export const canCopyShare = (m: Pick<ClassMessage, "created_at">, at: number, restricted: boolean) => !restricted || !copyShareClosed(m, at);

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", pdf: "application/pdf", mp4: "video/mp4", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4", txt: "text/plain", csv: "text/csv", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", zip: "application/zip" };
/** A picker may not say what the file is; fall back to its extension, then to "some file". */
export const mimeFor = (name: string, given?: string | null) => (given && given.includes("/") ? given : MIME_BY_EXT[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream");
/** The unsent messages of this chat, from the outbox, oldest first. */
export function pendingForSession(rows: { id: string; kind: string; status: string; created_at: number; payload: unknown }[], sessionId: string): PendingRow[] {
  return rows
    .map((r) => {
      // a text message is an rpc row; an attachment is an upload row whose follow-up step posts the message
      const p = r.payload as { name?: string; args?: Record<string, unknown>; after?: { kind?: string; name?: string; args?: Record<string, unknown> } };
      const args = r.kind === "rpc" && p.name === "send_class_message" ? p.args : r.kind === "upload" && p.after?.kind === "rpc" && p.after.name === "send_class_message" ? p.after.args : undefined;
      return args && args.p_session_id === sessionId ? { id: r.id, at: r.created_at, body: (args.p_body as string | null) ?? null, status: r.status, mediaName: (args.p_media_name as string | null) ?? null } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...rest }) => rest);
}
