import type { ClassMessage } from "@/features/channels/format";
import { ADMIN_PAGE, captionOf, deletePreview, hasMore, isFileNotRemoved, joinPages, newestFirst, olderThan } from "@/features/channels/adminLogic";

const m = (id: string, sec: number, o: Partial<ClassMessage> = {}): ClassMessage => ({ id, session_id: "S", sender_label: "Ada", body: `b${id}`, media_path: null, media_name: null, media_mime: null, media_size: null, created_at: new Date(Date.UTC(2026, 9, 12, 8, 0, sec)).toISOString(), ...o });

describe("admin class messages", () => {
  it("captions a message with what the server sent, skipping what is missing", () => {
    expect(captionOf({ course_title: "AI Basics", centre_name: "Lagos", session_date: "2026-10-12" })).toMatch(/^AI Basics · Lagos · .*12/);
    expect(captionOf({ course_title: "AI Basics", centre_name: null, session_date: null })).toBe("AI Basics");
    expect(captionOf({})).toBe("");
  });
  it("previews a text message cut at 80 characters, or names the file", () => {
    expect(deletePreview({ body: "hello", media_name: null })).toBe("“hello”");
    expect(deletePreview({ body: "x".repeat(81), media_name: null })).toBe(`“${"x".repeat(80)}…”`);
    expect(deletePreview({ body: "x".repeat(80), media_name: null })).toBe(`“${"x".repeat(80)}”`);
    expect(deletePreview({ body: null, media_name: "slides.pdf" })).toBe("slides.pdf");
    expect(deletePreview({ body: null, media_name: null })).toBe("this file");
  });
  it("lists newest first, and a full page means there may be more", () => {
    expect(newestFirst([m("a", 1), m("c", 3), m("b", 2)]).map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(hasMore(Array.from({ length: ADMIN_PAGE }, (_, i) => m(`${i}`, i)))).toBe(true);
    expect(hasMore([m("a", 1)])).toBe(false);
  });
  it("joins later pages without repeats and drops deleted messages; the cursor is the oldest held", () => {
    const first = [m("c", 3), m("b", 2)]; const later = [m("b", 2), m("a", 1)];
    expect(joinPages(first, later, new Set())!.map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(joinPages(first, later, new Set(["b"]))!.map((x) => x.id)).toEqual(["c", "a"]);
    expect(joinPages(undefined, later, new Set())).toBeUndefined();
    expect(olderThan(joinPages(first, later, new Set())!)).toBe(m("a", 1).created_at);
    expect(olderThan([])).toBeUndefined();
  });
  it("treats a file that could not be removed as a delete that still happened", () => {
    expect(isFileNotRemoved(new Error("file_not_removed"))).toBe(true);
    expect(isFileNotRemoved(new Error("permission denied"))).toBe(false);
    expect(isFileNotRemoved(undefined)).toBe(false);
  });
});
