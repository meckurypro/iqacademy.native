import { migrate } from "@/data/db/migrations";
import { createCacheRepo } from "@/data/db/cacheRepo";
import { mergeRows, needsFull, refreshDelta, emptyBox, type DeltaSpec } from "@/data/query/delta";
import { QueryEngine, stableKey } from "@/data/query/engine";
import { prefetchPlan, runPrefetch } from "@/data/prefetch";
import { applyRoleChange, classifyRoleChange, identityKeys, roleSignature } from "@/data/roleWipe";
import { nodeDb } from "./helpers/nodeDb";

type Msg = { id: string; at: string; body: string };
const spec: DeltaSpec<Msg> = { idOf: (m) => m.id, cursorOf: (m) => m.at, order: "asc" };
const m = (id: string, at: string, body = id): Msg => ({ id, at, body });

describe("changes-since merge", () => {
  it("adds new rows, replaces edited ones, keeps order", () => {
    const held = [m("a", "2026-01-01"), m("b", "2026-01-02")];
    const out = mergeRows(held, [m("b", "2026-01-02", "edited"), m("c", "2026-01-03")], spec);
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"]); expect(out[1].body).toBe("edited");
  });
  it("newest-first lists stay newest-first", () => {
    expect(mergeRows([m("a", "1"), m("b", "2")].reverse(), [m("c", "3")], { ...spec, order: "desc" }).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
  it("does a full load first, then only asks for rows since the cursor", async () => {
    const all = jest.fn(async () => [m("a", "1"), m("b", "2")]); const since = jest.fn(async () => [m("c", "3")]);
    const first = await refreshDelta({ prev: undefined, spec, now: 1000, fullEveryMs: 10_000, fetchAll: all, fetchSince: since });
    expect(all).toHaveBeenCalledTimes(1); expect(first.cursor).toBe("2");
    const second = await refreshDelta({ prev: first, spec, now: 2000, fullEveryMs: 10_000, fetchAll: all, fetchSince: since });
    expect(since).toHaveBeenCalledWith("2"); expect(all).toHaveBeenCalledTimes(1); expect(second.rows.map((r) => r.id)).toEqual(["a", "b", "c"]); expect(second.fullAt).toBe(1000);
  });
  it("forces a full reload when asked or when the last one is old (deletions are invisible to a delta)", async () => {
    const box = { rows: [m("a", "1")], cursor: "1", fullAt: 0 };
    expect(needsFull(box, 5_000, 10_000)).toBe(false); expect(needsFull(box, 20_000, 10_000)).toBe(true); expect(needsFull(box, 5_000, 10_000, true)).toBe(true);
    expect(needsFull(emptyBox(), 1, 10)).toBe(true); expect(needsFull(undefined, 1, 10)).toBe(true);
    const all = jest.fn(async () => [m("z", "9")]);
    const out = await refreshDelta({ prev: box, spec, now: 20_000, fullEveryMs: 10_000, fetchAll: all, fetchSince: async () => [] });
    expect(out.rows.map((r) => r.id)).toEqual(["z"]); // the deleted row "a" is gone after the full reload
  });
  it("an empty delta changes nothing", async () => {
    const box = { rows: [m("a", "1")], cursor: "1", fullAt: 0 };
    expect((await refreshDelta({ prev: box, spec, now: 1, fullEveryMs: 1e9, fetchAll: async () => [], fetchSince: async () => [] })).rows).toEqual(box.rows);
  });
});

describe("engine passes what it holds to the fetcher, and can reset", () => {
  const mk = async () => { const db = nodeDb(); await migrate(db); const cache = createCacheRepo(db); return { db, cache, eng: new QueryEngine({ cache, now: () => 1000, isOnline: () => true }) }; };
  it("fn receives the previous data on a refetch", async () => {
    const { eng } = await mk(); const seen: unknown[] = [];
    const fn = jest.fn(async (prev?: unknown) => { seen.push(prev); return { n: seen.length }; });
    await eng.ensure("k", { fn, tags: [], ttlMs: 0 }); await eng.fetch("k");
    expect(seen[0]).toBeUndefined(); expect(seen[1]).toEqual({ n: 1 });
  });
  it("reset forgets everything except the kept keys", async () => {
    const { eng } = await mk();
    await eng.ensure("keep", { fn: async () => 1, tags: [], ttlMs: 1e9 }); await eng.ensure("drop", { fn: async () => 2, tags: [], ttlMs: 1e9 });
    eng.reset(["keep"]);
    expect(eng.getState("keep").data).toBe(1); expect(eng.getState("drop").status).toBe("idle");
  });
});

describe("role switch", () => {
  const R = (role: string, centre_id: string | null = null) => ({ role, centre_id }) as never;
  it("signature ignores order and duplicates", () => {
    expect(roleSignature([R("student"), R("instructor")])).toBe(roleSignature([R("instructor"), R("student"), R("student")]));
    expect(roleSignature([R("coordinator", "c1")])).not.toBe(roleSignature([R("coordinator", "c2")]));
  });
  it("first / same / changed", () => { expect(classifyRoleChange(null, "x")).toBe("first"); expect(classifyRoleChange("x", "x")).toBe("same"); expect(classifyRoleChange("x", "y")).toBe("changed"); });
  it("wipes cached lists but keeps who-am-I and the unsent outbox", async () => {
    const db = nodeDb(); await migrate(db); const cache = createCacheRepo(db); const eng = new QueryEngine({ cache, now: () => 1, isOnline: () => true });
    const [rolesKey, profileKey] = identityKeys("u1");
    for (const k of [rolesKey, profileKey, "director-list"]) await cache.put(k, "{}", ["t"], 1000, 1);
    await db.run("INSERT INTO outbox (id, kind, payload, created_at) VALUES ('o1','rpc','{}',1)");
    const rt = { db, engine: eng, uid: "u1" };
    expect(await applyRoleChange(rt, [R("centre_director", "c1")])).toBe("first");
    expect(await cache.get("director-list")).not.toBeNull();            // first sign-in: nothing to clear
    expect(await applyRoleChange(rt, [R("centre_director", "c1")])).toBe("same");
    expect(await applyRoleChange(rt, [R("student")])).toBe("changed");
    expect(await cache.get("director-list")).toBeNull();
    expect(await cache.get(rolesKey)).not.toBeNull(); expect(await cache.get(profileKey)).not.toBeNull();
    expect((await db.first<{ n: number }>("SELECT count(*) AS n FROM outbox"))?.n).toBe(1);
  });
});

describe("first-launch prefetch", () => {
  const R = (role: string, centre_id: string | null = null) => ({ role, centre_id }) as never;
  const names = (p: ReturnType<typeof prefetchPlan>) => p.map((x) => x.name);
  it("students warm their own lists", () => expect(names(prefetchPlan([R("student")]))).toEqual(expect.arrayContaining(["my_class_channels", "my_offline_payments", "my_pending_review"])));
  it("staff do not fetch the student bundle", () => expect(names(prefetchPlan([R("instructor")]))).not.toContain("my_offline_payments"));
  it("directors warm each of their centres, once", () => {
    const p = prefetchPlan([R("centre_director", "c1"), R("centre_director", "c1"), R("coordinator", "c2")]);
    expect(p.filter((x) => x.name === "centre_dashboard").map((x) => x.args)).toEqual([{ p_centre_id: "c1" }]);
    expect(p.filter((x) => x.name === "centre_students").map((x) => x.args)).toEqual([{ p_centre_id: "c1" }, { p_centre_id: "c2" }]);
  });
  it("uses the same keys as useRpc, ignores failures, and stops when told to", async () => {
    const keys: string[] = []; let live = true;
    const engine = { ensure: jest.fn(async (k: string, meta: { fn: () => Promise<unknown> }) => { keys.push(k); if (keys.length === 2) throw new Error("boom"); await meta.fn().catch(() => {}); if (keys.length === 3) live = false; }) };
    const sb = { rpc: jest.fn(async () => ({ data: 1, error: null })) } as never;
    const plan = prefetchPlan([R("student")]);
    await runPrefetch(engine as never, sb, plan, () => live, 1);
    expect(keys[0]).toBe(stableKey(["rpc", plan[0].name, plan[0].args]));
    expect(keys.length).toBe(3); // third call flipped `live`, the rest never ran
  });
});
