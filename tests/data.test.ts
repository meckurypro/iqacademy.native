import { migrate, SCHEMA_VERSION } from "@/data/db/migrations";
import { createCacheRepo, tagString } from "@/data/db/cacheRepo";
import { createOutboxRepo } from "@/data/db/outboxRepo";
import { QueryEngine, stableKey } from "@/data/query/engine";
import { backoffMs, createOutbox, defaultClassify } from "@/data/outbox/engine";
import { policyFor } from "@/data/policies";
import { nodeDb } from "./helpers/nodeDb";

let t = 1_000_000; const now = () => t;
const setup = async () => { const db = nodeDb(); await migrate(db); return db; };

describe("local schema", () => {
  it("migrates once and is idempotent", async () => {
    const db = nodeDb();
    expect(await migrate(db)).toBe(SCHEMA_VERSION);
    expect(await migrate(db)).toBe(SCHEMA_VERSION);
    const names = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name).sort();
    expect(names).toEqual(["blob_index", "cache_entries", "kv", "outbox"]);
    expect((await db.first<{ user_version: number }>("PRAGMA user_version"))?.user_version).toBe(SCHEMA_VERSION);
  });
  it("refuses a database from a newer app", async () => {
    const db = nodeDb(); await db.exec("PRAGMA user_version = 99");
    await expect(migrate(db)).rejects.toThrow(/newer/);
  });
});

describe("cache repo", () => {
  it("stores, replaces and marks stale by tag only", async () => {
    const c = createCacheRepo(await setup());
    await c.put("a", '{"x":1}', ["notifications"], 1000, 5);
    await c.put("b", "[]", ["messages", "class:1"], 1000, 5);
    await c.markStale(["notifications"]);
    expect((await c.get("a"))?.stale).toBe(1);
    expect((await c.get("b"))?.stale).toBe(0);
    await c.put("a", '{"x":2}', ["notifications"], 1000, 9);
    expect(await c.get("a")).toMatchObject({ payload: '{"x":2}', stale: 0, fetched_at: 9 });
    await c.markStale(["class:1"]);
    expect((await c.get("b"))?.stale).toBe(1);
  });
  it("rejects tags that could act as LIKE wildcards", () => {
    expect(() => tagString(["a%b"])).toThrow(); expect(() => tagString(["a_b c"])).toThrow(); expect(tagString(["class:1", "x"])).toBe("|class:1|x|");
  });
});

describe("query engine", () => {
  const mk = async (online = true) => { const db = await setup(); const cache = createCacheRepo(db); const flags = { online }; const eng = () => new QueryEngine({ cache, now, isOnline: () => flags.online }); return { db, cache, flags, eng }; };
  const meta = (fn: () => Promise<unknown>, tags: string[] = [], ttlMs = 60_000) => ({ fn, tags, ttlMs });

  it("keys are stable regardless of property order", () => { expect(stableKey(["rpc", "x", { b: 1, a: 2 }])).toBe(stableKey(["rpc", "x", { a: 2, b: 1 }])); });

  it("fetches, caches, and a NEW engine shows the cached copy at once (cold start)", async () => {
    const { eng } = await mk(); const fn = jest.fn(async () => ({ n: 1 }));
    const a = eng(); await a.ensure("k", meta(fn)); expect(a.getState("k")).toMatchObject({ status: "success", data: { n: 1 }, fromCache: false });
    await new Promise((r) => setTimeout(r, 5)); // cache write is fire-and-forget
    const b = eng(); let seen: unknown; const slow = () => new Promise((r) => setTimeout(() => r({ n: 2 }), 30));
    const p = b.ensure("k", meta(slow, [], 0)); await new Promise((r) => setTimeout(r, 5));
    seen = b.getState("k"); expect(seen).toMatchObject({ data: { n: 1 }, fromCache: true }); // old data visible while refreshing
    await p; expect(b.getState("k")).toMatchObject({ data: { n: 2 }, fromCache: false });
  });

  it("does not hit the network while data is fresh (saves mobile data)", async () => {
    const { eng } = await mk(); const e = eng(); const fn = jest.fn(async () => 1);
    await e.ensure("k", meta(fn)); await e.ensure("k", meta(fn)); expect(fn).toHaveBeenCalledTimes(1);
    t += 61_000; await e.ensure("k", meta(fn)); expect(fn).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent fetches", async () => {
    const { eng } = await mk(); const e = eng(); const fn = jest.fn(async () => { await new Promise((r) => setTimeout(r, 10)); return 1; });
    await Promise.all([e.ensure("k", meta(fn)), e.ensure("k", meta(fn)), e.ensure("k", meta(fn))]); expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invalidate refetches what is watched and only marks the rest stale", async () => {
    const { eng } = await mk(); const e = eng(); let n = 0; const fn = async () => ++n;
    const unsub = e.subscribe("watched", () => {});
    await e.ensure("watched", meta(fn, ["notifications"])); await e.ensure("idle", meta(fn, ["notifications"]));
    expect([e.getState("watched").data, e.getState("idle").data]).toEqual([1, 2]);
    e.invalidate(["notifications"]); await new Promise((r) => setTimeout(r, 10));
    expect(e.getState("watched").data).toBe(3);   // refetched
    expect(e.getState("idle")).toMatchObject({ data: 2, stale: true }); // not on screen: just marked
    e.invalidate(["unrelated"]); expect(e.getState("watched").stale).toBe(false); unsub();
  });

  it("offline: keeps showing cached data, marks nothing as failed, and reports an error only when there is nothing to show", async () => {
    const { eng, flags } = await mk(); const fn = jest.fn(async () => "x");
    await eng().ensure("k", meta(fn)); await new Promise((r) => setTimeout(r, 5));
    flags.online = false; t += 120_000; const e = eng(); await e.ensure("k", meta(fn));
    expect(e.getState("k")).toMatchObject({ data: "x", status: "success" }); expect(fn).toHaveBeenCalledTimes(1);
    await e.ensure("never-seen", meta(fn)); expect(e.getState("never-seen")).toMatchObject({ status: "error", data: undefined });
  });

  it("a failed refresh keeps the old data on screen", async () => {
    const { eng } = await mk(); const e = eng(); await e.ensure("k", meta(async () => "good"));
    t += 120_000; await e.ensure("k", meta(async () => { throw new Error("boom"); }));
    expect(e.getState("k")).toMatchObject({ data: "good", status: "success" }); expect(String((e.getState("k").error as Error).message)).toBe("boom");
  });
});

describe("outbox", () => {
  const rig = async (o: { online?: boolean; classify?: (e: unknown) => "retry" | "fatal" } = {}) => {
    const db = await setup(); const repo = createOutboxRepo(db); const flags = { online: o.online ?? true }; const sent: unknown[] = []; const done: string[][] = []; let n = 0;
    const handlers = { rpc: jest.fn(async (p: { n: number }) => { sent.push(p.n); }) };
    const box = createOutbox({ repo, handlers, isOnline: () => flags.online, now, newId: () => `id${++n}`, onDone: (tags) => done.push(tags), classify: o.classify });
    return { db, repo, box, flags, sent, done, handlers };
  };

  it("sends in order, deletes on success, reports the tags to refresh", async () => {
    const { box, sent, done } = await rig();
    await box.enqueue("rpc", { n: 1 }, { scope: "a", tags: ["x"] }); await box.enqueue("rpc", { n: 2 }, { scope: "a" });
    await box.flush();
    expect(sent).toEqual([1, 2]); expect(box.snapshot()).toEqual({ pending: 0, failed: 0, dead: 0 }); expect(done[0]).toEqual(["x"]);
  });

  it("holds everything while offline and survives a restart (rows live in the DB)", async () => {
    const { db, box, flags, sent, handlers } = await rig({ online: false });
    await box.enqueue("rpc", { n: 1 }); await box.flush(); expect(sent).toEqual([]); expect(box.snapshot().pending).toBe(1);
    const box2 = createOutbox({ repo: createOutboxRepo(db), handlers, isOnline: () => flags.online, now, newId: () => "z", onDone: () => {} });
    await box2.start(); expect(box2.snapshot().pending).toBe(1);
    flags.online = true; await box2.flush(); expect(sent).toEqual([1]); expect(box2.snapshot().pending).toBe(0);
  });

  it("a row stuck 'sending' when the app was killed goes back to pending", async () => {
    const { repo, box } = await rig(); await box.enqueue("rpc", { n: 1 }); await repo.markSending("id1");
    expect((await repo.counts()).pending).toBe(1); await box.start(); expect((await repo.list())[0].status).toBe("pending");
  });

  it("network failure: retries later with backoff and keeps order inside the scope", async () => {
    const { box, handlers, sent } = await rig();
    handlers.rpc.mockRejectedValueOnce(new TypeError("Network request failed"));
    await box.enqueue("rpc", { n: 1 }, { scope: "a" }); await box.enqueue("rpc", { n: 2 }, { scope: "a" });
    await box.flush(); expect(sent).toEqual([]); expect(box.snapshot()).toEqual({ pending: 1, failed: 1, dead: 0 });
    await box.flush(); expect(sent).toEqual([]);                         // not due yet: backoff holds
    t += backoffMs(1) + 1; await box.flush(); expect(sent).toEqual([1, 2]); // 1 before 2
  });

  it("a rule the server enforced is dead at once and does not block other work", async () => {
    const { box, handlers, sent } = await rig();
    handlers.rpc.mockRejectedValueOnce(Object.assign(new Error("session_closed"), { code: "P0001" }));
    await box.enqueue("rpc", { n: 1 }, { scope: "a" }); await box.enqueue("rpc", { n: 2 }, { scope: "a" }); await box.enqueue("rpc", { n: 3 }, { scope: "b" });
    await box.flush(); expect([...sent].sort()).toEqual([2, 3]); // order is guaranteed inside a scope, not across scopes
    expect(box.snapshot()).toEqual({ pending: 0, failed: 0, dead: 1 });
    const [dead] = (await box.list()); expect(dead.last_error).toBe("session_closed"); await box.revive(dead.id); expect(box.snapshot().pending).toBe(1);
  });

  it("gives up after the maximum number of attempts", async () => {
    const { box, handlers } = await rig(); handlers.rpc.mockRejectedValue(Object.assign(new Error("bad gateway"), { status: 502 }));
    await box.enqueue("rpc", { n: 1 });
    for (let i = 0; i < 10; i++) { t += 6 * 60_000; await box.flush(); }
    expect(box.snapshot().dead).toBe(1);
  });

  it("unknown kinds are parked, not retried forever", async () => { const { box } = await rig(); await box.enqueue("nope", {}); await box.flush(); expect(box.snapshot().dead).toBe(1); });

  it("classifies errors", () => {
    expect(defaultClassify(new TypeError("Network request failed"))).toBe("retry");
    expect(defaultClassify({ status: 503 })).toBe("retry"); expect(defaultClassify({ status: 429 })).toBe("retry");
    expect(defaultClassify({ code: "P0001", message: "not_enrolled" })).toBe("fatal");
  });
});

describe("offline policy", () => {
  it("only harmless, repeatable actions are queued; everything the server decides is online-only", () => {
    expect(policyFor("mark_notifications_read").mode).toBe("queue");
    expect(policyFor("mark_channel_read").mode).toBe("queue");
    for (const r of ["check_in", "set_pin", "mark_attendance", "create_enrolment", "send_class_message", "anything_unlisted"]) expect(policyFor(r).mode).toBe("online");
  });
});
