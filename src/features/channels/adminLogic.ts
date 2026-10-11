// Pure rules of the admin "Class messages" page (web pages/ClassMessagesAdmin.tsx @d14323f): the caption over each message, the delete confirmation, the paging, and what a failed delete means.
import { fmtDay } from "@/shared/web/time";
import { mergeMessages, type ClassMessage } from "./format";

export const ADMIN_PAGE = 30;

/** "Course · Centre · 12 Oct": whatever of the three the server sent. */
export const captionOf = (m: Pick<ClassMessage, "course_title" | "centre_name" | "session_date">) =>
  [m.course_title, m.centre_name, m.session_date && fmtDay(m.session_date, { day: "numeric", month: "short" })].filter(Boolean).join(" · ");

/** What the confirmation shows so the admin knows which message they are about to delete. */
export const deletePreview = (m: Pick<ClassMessage, "body" | "media_name">) =>
  m.body ? `“${m.body.slice(0, 80)}${m.body.length > 80 ? "…" : ""}”` : m.media_name ?? "this file";

/** A page from the server is newest-first once reversed from the merge order; a full page means there may be more. */
export const newestFirst = (rows: ClassMessage[]) => mergeMessages([], rows).reverse();
export const hasMore = (rows: ClassMessage[]) => rows.length === ADMIN_PAGE;
/** The first page plus the pages loaded after it, without a message shown twice (a refresh of page one can overlap). */
export const joinPages = (first: ClassMessage[] | undefined, later: ClassMessage[], removed: ReadonlySet<string>) => {
  if (!first) return undefined;
  const seen = new Set(first.map((m) => m.id));
  return [...first, ...later.filter((m) => !seen.has(m.id))].filter((m) => !removed.has(m.id));
};
/** The cursor for "Show older": the oldest message held. */
export const olderThan = (msgs: ClassMessage[]) => msgs[msgs.length - 1]?.created_at;

/** The message is gone from the database even when its file could not be removed from storage, so the list drops it either way. */
export const FILE_NOT_REMOVED = "file_not_removed";
export const isFileNotRemoved = (e: unknown) => new RegExp(FILE_NOT_REMOVED).test(String((e as Error | undefined)?.message ?? e));
