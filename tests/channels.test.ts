import { COPY_SHARE_WINDOW_MS, PAGE, copyShareClosed, fileSize, layoutFlags, mergeMessages, nextMessages, pendingForSession, type ClassMessage } from "@/features/channels/format";

const iso = (n: number) => new Date(Date.UTC(2026, 9, 12, 8, 0, n)).toISOString();
const msg = (i: number, label = "Instructor Ada"): ClassMessage => ({ id: `m${i}`, session_id: "s", sender_label: label, body: `b${i}`, media_path: null, media_name: null, media_mime: null, media_size: null, created_at: iso(i) });
const run = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => msg(a + k));
const ids = (m: ClassMessage[]) => m.map((x) => x.id);

describe("channel refresh", () => {
  it("a short newest page is the whole channel: it replaces what we held, so a deleted message disappears", () => {
    const held = run(1, 5); const latest = [msg(1), msg(2), msg(4), msg(5)]; // m3 was deleted
    expect(ids(nextMessages(held, latest))).toEqual(["m1", "m2", "m4", "m5"]);
  });
  it("a full newest page keeps older pages already loaded, and drops what vanished inside the newest window", () => {
    const held = run(1, PAGE + 20); // loaded earlier: 60 messages
    const latest = run(21, PAGE + 20).filter((m) => m.id !== "m30"); // newest window, m30 deleted... but window is now PAGE-1 long
    const padded = [...latest, msg(PAGE + 21)];                     // a new message arrived, so the page is full again
    const out = nextMessages(held, padded.slice(-PAGE));
    expect(ids(out).includes("m1")).toBe(true);                    // older page kept
    expect(ids(out).includes("m30")).toBe(false);                   // deleted inside the window
    expect(ids(out)).toContain(`m${PAGE + 21}`);                    // the new one is there
  });
  it("first load and unsorted input come back oldest-first", () => {
    expect(ids(nextMessages(undefined, [msg(3), msg(1), msg(2)]))).toEqual(["m1", "m2", "m3"]);
    expect(ids(mergeMessages([msg(2)], [msg(2), msg(1)]))).toEqual(["m1", "m2"]);
  });
});

describe("bubble layout", () => {
  const day = (s: string) => s.slice(0, 10);
  it("starts a run on a new sender or a new day", () => {
    const m = [msg(1, "A"), msg(2, "A"), msg(3, "B"), { ...msg(4, "B"), created_at: "2026-10-13T08:00:00.000Z" }];
    expect(layoutFlags(m, 0, day)).toEqual({ newDay: true, first: true });
    expect(layoutFlags(m, 1, day)).toEqual({ newDay: false, first: false });
    expect(layoutFlags(m, 2, day)).toEqual({ newDay: false, first: true });
    expect(layoutFlags(m, 3, day)).toEqual({ newDay: true, first: true });
  });
});

describe("copy window (students)", () => {
  it("closes two hours after the message arrives, by the server-corrected clock", () => {
    const m = msg(0); const t = Date.parse(m.created_at);
    expect(copyShareClosed(m, t + COPY_SHARE_WINDOW_MS - 1)).toBe(false); expect(copyShareClosed(m, t + COPY_SHARE_WINDOW_MS)).toBe(true);
  });
});

describe("pending messages from the outbox", () => {
  const row = (id: string, session: string, at: number, name = "send_class_message", status = "pending", kind = "rpc") => ({ id, kind, status, created_at: at, payload: { name, args: { p_session_id: session, p_body: `text ${id}` } } });
  it("only this chat's unsent messages, oldest first", () => {
    const out = pendingForSession([row("b", "s1", 2), row("a", "s1", 1), row("x", "s2", 0), row("n", "s1", 3, "mark_channel_read"), row("u", "s1", 4, "x", "pending", "upload")], "s1");
    expect(out.map((r) => r.id)).toEqual(["a", "b"]); expect(out[0].body).toBe("text a");
  });
  it("carries the status so the bubble can say sending / will retry / not sent", () => {
    expect(pendingForSession([row("d", "s1", 1, "send_class_message", "dead")], "s1")[0].status).toBe("dead");
  });
});

describe("file size wording", () => {
  it("KB under a megabyte, MB above", () => { expect(fileSize(null)).toBe(""); expect(fileSize(10)).toBe("1 KB"); expect(fileSize(2048)).toBe("2 KB"); expect(fileSize(5.5 * 1024 * 1024)).toBe("5.5 MB"); });
});
