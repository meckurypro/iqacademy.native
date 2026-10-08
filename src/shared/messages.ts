// PORT-OF web src/lib/messages.ts @0081e66 — pure part. Download/share/copy/forward and the unread hook belong to M8 (they need native file + share APIs).
import { fmtClock, now } from "./web/time";

export const BUCKET = "class-messages";
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
export const isImageMime = (mime: string | null | undefined) => !!mime && mime.startsWith("image/");

export type ClassMessage = {
  id: string; session_id: string; sender_label: string; body: string | null;
  media_path: string | null; media_name: string | null; media_mime: string | null; media_size: number | null;
  created_at: string; course_title?: string | null; centre_name?: string | null; session_date?: string | null;
};

/** Students can copy or share a message only for this long after it arrives. */
export const COPY_SHARE_WINDOW_MS = 2 * 60 * 60 * 1000;
export const copyShareEndsAt = (m: Pick<ClassMessage, "created_at">) => Date.parse(m.created_at) + COPY_SHARE_WINDOW_MS;
/** True once the window has passed. Uses the server-corrected clock. */
export const copyShareClosed = (m: Pick<ClassMessage, "created_at">) => now() >= copyShareEndsAt(m);
export const copyShareNote = (m: Pick<ClassMessage, "created_at">) => `Copy and share close 2 hours after a message arrives (${fmtClock(copyShareEndsAt(m))}).`;

export const mergeMessages = (a: ClassMessage[], b: ClassMessage[]) => {
  const m = new Map<string, ClassMessage>(); [...a, ...b].forEach((x) => m.set(x.id, x));
  return [...m.values()].sort((x, y) => +new Date(x.created_at) - +new Date(y.created_at));
};

export const fileSize = (n: number | null) => !n ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
