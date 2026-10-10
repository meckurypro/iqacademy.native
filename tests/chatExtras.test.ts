import { chatMediaJob, chatMediaPath, safeName, MAX_MEDIA_BYTES } from "@/data/uploads";
import { labelForRow } from "@/data/policies";
import { MAX_SELECT, canCopyShare, mimeFor, pendingForSession, toggleSelection, type ClassMessage } from "@/features/channels/format";
import { sendToChats, type Media, type SendDeps } from "@/features/channels/sendToChats";
import { reviewArgs, validateReview } from "@/features/channels/review";

const iso = (n: number) => new Date(Date.UTC(2026, 9, 12, 8, 0, n)).toISOString();
const msg = (i: number, o: Partial<ClassMessage> = {}): ClassMessage => ({ id: `m${i}`, session_id: "src", sender_label: "Instructor Ada", body: `b${i}`, media_path: null, media_name: null, media_mime: null, media_size: null, created_at: iso(i), ...o });

describe("attachments for a class chat", () => {
  it("builds one upload that then posts the message, with a fixed path and client id", () => {
    const j = chatMediaJob({ sessionId: "S1", body: "  notes  ", name: "Week 1 notes (final).pdf", mime: "application/pdf", size: 1000, id: "cid" });
    expect(j.bucket).toBe("class-messages"); expect(j.scope).toBe("chat:S1"); expect(j.upsert).toBe(false);
    expect(j.path).toBe("S1/cid-Week_1_notes_final_.pdf");
    expect(j.after).toEqual({ kind: "rpc", name: "send_class_message", args: { p_session_id: "S1", p_body: "notes", p_media_path: j.path, p_media_name: "Week 1 notes (final).pdf", p_media_mime: "application/pdf", p_media_size: 1000, p_client_id: "cid" } });
  });
  it("path starts with the class id (the database requires it) and names are made safe", () => {
    expect(chatMediaPath("S", "i", "../../etc/passwd").startsWith("S/i-")).toBe(true);
    expect(safeName("../a b/ü.png")).not.toMatch(/[\/ ]/); expect(safeName("").length).toBeGreaterThan(0); expect(safeName("x".repeat(200)).length).toBe(80);
  });
  it("refuses empty or oversize files, and falls back on odd mime types", () => {
    const base = { sessionId: "S", body: null, name: "a.bin", id: "i" };
    expect(() => chatMediaJob({ ...base, mime: "x/y", size: 0 })).toThrow("under 25 MB");
    expect(() => chatMediaJob({ ...base, mime: "x/y", size: MAX_MEDIA_BYTES + 1 })).toThrow("under 25 MB");
    expect(chatMediaJob({ ...base, mime: "", size: 5 }).mime).toBe("application/octet-stream");
    expect(chatMediaJob({ ...base, mime: "Not A Mime", size: 5 }).mime).toBe("application/octet-stream");
    expect(chatMediaJob({ ...base, mime: "image/png", size: MAX_MEDIA_BYTES }).mime).toBe("image/png");
    expect((chatMediaJob({ ...base, mime: "image/png", size: 5 }).after as unknown as { args: { p_body: unknown } }).args.p_body).toBeNull();
  });
  it("guesses a type from the extension when the picker does not say", () => {
    expect(mimeFor("a.PDF")).toBe("application/pdf"); expect(mimeFor("photo.jpeg", null)).toBe("image/jpeg"); expect(mimeFor("x.weird")).toBe("application/octet-stream"); expect(mimeFor("a.pdf", "text/plain")).toBe("text/plain");
  });
  it("an unsent attachment shows in this chat's pending list with its file name", () => {
    const upload = { id: "u", kind: "upload", status: "pending", created_at: 5, payload: { after: { kind: "rpc", name: "send_class_message", args: { p_session_id: "S1", p_body: "see this", p_media_name: "plan.pdf" } } } };
    const other = { ...upload, id: "o", payload: { after: { kind: "rpc", name: "submit_offline_receipt", args: { p_session_id: "S1" } } } };
    const out = pendingForSession([upload, other, { ...upload, id: "x", payload: { after: { kind: "rpc", name: "send_class_message", args: { p_session_id: "S2" } } } }], "S1");
    expect(out).toEqual([{ id: "u", body: "see this", status: "pending", mediaName: "plan.pdf" }]);
    expect(labelForRow({ kind: "upload", payload: { bucket: "class-messages" } })).toBe("Send attachment");
  });
});

describe("send to other classes", () => {
  const mk = (o: { failOn?: (args: Record<string, unknown>) => boolean } = {}) => {
    let n = 0; const sent: Record<string, unknown>[] = []; const uploads: string[] = []; const fetched: string[] = [];
    const d: SendDeps = {
      newId: () => `id${++n}`,
      fetchMedia: async (m) => { fetched.push(m.id); return { bytes: new ArrayBuffer(3), mime: m.media_mime ?? "application/pdf", size: 3 } as Media; },
      upload: async (p) => { uploads.push(p); },
      send: async (a) => { if (o.failOn?.(a)) throw new Error("boom"); sent.push(a); },
    };
    return { d, sent, uploads, fetched };
  };
  it("sends in original order to every chat, as new messages with a client id each", async () => {
    const t = mk(); const r = await sendToChats([msg(2), msg(1)], ["A", "B"], t.d);
    expect(r).toEqual({ ok: ["A", "B"], failed: [] });
    expect(t.sent.map((s) => `${s.p_session_id}:${s.p_body}`)).toEqual(["A:b1", "A:b2", "B:b1", "B:b2"]);
    expect(new Set(t.sent.map((s) => s.p_client_id)).size).toBe(4);
  });
  it("copies a file into each target's own folder, fetching it only once", async () => {
    const t = mk(); const m = msg(1, { media_path: "src/old.pdf", media_name: "plan.pdf", media_mime: "application/pdf", media_size: 3 });
    await sendToChats([m], ["A", "B"], t.d);
    expect(t.fetched).toEqual(["m1"]); expect(t.uploads[0].startsWith("A/")).toBe(true); expect(t.uploads[1].startsWith("B/")).toBe(true);
    expect((t.sent[0].p_media_path as string).startsWith("A/")).toBe(true); expect(t.sent[0].p_media_name).toBe("plan.pdf");
  });
  it("stops a chat at its first failure (no gap) but carries on with the others", async () => {
    const t = mk({ failOn: (a) => a.p_session_id === "A" && a.p_body === "b2" });
    const r = await sendToChats([msg(1), msg(2), msg(3)], ["A", "B"], t.d);
    expect(r).toEqual({ ok: ["B"], failed: ["A"] });
    expect(t.sent.filter((s) => s.p_session_id === "A").map((s) => s.p_body)).toEqual(["b1"]); // b3 was NOT sent after b2 failed
    expect(t.sent.filter((s) => s.p_session_id === "B")).toHaveLength(3);
  });
  it("a retry with the same ids resends the same client ids and file paths, so nothing is posted twice", async () => {
    const ids = new Map<string, string>(); let fail = true;
    const t1 = mk({ failOn: (a) => fail && a.p_body === "b2" });
    const m1 = msg(1, { media_path: "x/1", media_name: "a.pdf" });
    await sendToChats([m1, msg(2)], ["A"], t1.d, ids);
    const first = t1.sent[0]; fail = false;
    const t2 = mk(); await sendToChats([m1, msg(2)], ["A"], t2.d, ids);
    expect(t2.sent[0].p_client_id).toBe(first.p_client_id); expect(t2.sent[0].p_media_path).toBe(first.p_media_path);
  });
});

describe("selecting messages", () => {
  it("toggles, and refuses past the limit", () => {
    let s: Set<string> | null = null;
    for (let i = 0; i < MAX_SELECT; i++) s = toggleSelection(s, `m${i}`).set;
    expect(s!.size).toBe(MAX_SELECT);
    const over = toggleSelection(s, "extra"); expect(over.refused).toBe(true); expect(over.set.size).toBe(MAX_SELECT);
    const off = toggleSelection(s, "m0"); expect(off.refused).toBe(false); expect(off.set.has("m0")).toBe(false);
  });
  it("does not change the set it was given", () => { const a = new Set(["x"]); toggleSelection(a, "y"); expect([...a]).toEqual(["x"]); });
});

describe("copy and share window", () => {
  it("students are cut off after two hours; staff never are", () => {
    const m = msg(0); const t = Date.parse(m.created_at);
    expect(canCopyShare(m, t + 60_000, true)).toBe(true); expect(canCopyShare(m, t + 3 * 3600_000, true)).toBe(false); expect(canCopyShare(m, t + 3 * 3600_000, false)).toBe(true);
  });
});

describe("class review", () => {
  const base = { rating: 4, comment: "  good  ", report: false, why: "" };
  it("needs a rating, and a real reason when reporting", () => {
    expect(validateReview({ ...base, rating: 0 })).toContain("1 to 5 stars");
    expect(validateReview({ ...base, report: true, why: "rude" })).toContain("at least 10 characters");
    expect(validateReview({ ...base, report: true, why: "  was rude to people  " })).toBeNull(); expect(validateReview(base)).toBeNull();
  });
  it("sends the report reason only when reporting, and empty comments as null", () => {
    expect(reviewArgs("S", base)).toEqual({ p_session_id: "S", p_rating: 4, p_comment: "good", p_report: false, p_report_reason: null });
    expect(reviewArgs("S", { ...base, comment: "  ", report: true, why: " no-show " })).toEqual({ p_session_id: "S", p_rating: 4, p_comment: null, p_report: true, p_report_reason: "no-show" });
  });
});
