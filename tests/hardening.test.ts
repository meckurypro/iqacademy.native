import { migrate } from "@/data/db/migrations";
import { createCacheRepo } from "@/data/db/cacheRepo";
import { RPC_POLICIES, labelFor, policyFor, prepareQueued, type Policy } from "@/data/policies";
import { REALTIME_TABLES, createReconnectTracker } from "@/data/realtime";
import { nodeDb } from "./helpers/nodeDb";


const queued = (rpc: string) => { const p = policyFor(rpc); if (p.mode !== "queue") throw new Error(`${rpc} should be queued`); return p as Extract<Policy, { mode: "queue" }>; };

describe("queue policies", () => {
  it("queues chat sends, one ordered scope per class, with a client id filled once", () => {
    const p = queued("send_class_message"); let n = 0; const id = () => `id-${++n}`;
    const a = prepareQueued(p, { p_session_id: "s1", p_body: "hi" }, id);
    const b = prepareQueued(p, { p_session_id: "s2", p_body: "hi" }, id);
    expect(a.scope).toBe("chat:s1"); expect(b.scope).toBe("chat:s2");
    expect(a.args.p_client_id).toBe("id-1"); expect(b.args.p_client_id).toBe("id-2");
  });
  it("never replaces a client id the caller already chose, and does not mutate the input", () => {
    const p = queued("send_class_message"); const input = { p_session_id: "s1", p_client_id: "mine" };
    expect(prepareQueued(p, input, () => "new").args.p_client_id).toBe("mine");
    const input2 = { p_session_id: "s1" }; prepareQueued(p, input2, () => "new"); expect(input2).toEqual({ p_session_id: "s1" });
  });
  it("keeps server-decided actions online-only", () => {
    for (const r of ["check_in", "mark_attendance", "set_pin", "create_solo_enrolment", "can_buy_solo"]) expect(policyFor(r)).toEqual({ mode: "online" });
  });
  it("every queued rpc has a label and a static or functional scope", () => {
    for (const [name, p] of Object.entries(RPC_POLICIES)) if (p.mode === "queue") { expect(labelFor(name).length).toBeGreaterThan(3); expect(p.invalidates.length).toBeGreaterThan(0); }
    expect(labelFor("something_else")).toBe("Saved change");
  });
});

describe("cache prune", () => {
  const seed = async (rows: { k: string; size: number; at: number }[]) => { const db = nodeDb(); await migrate(db); const c = createCacheRepo(db); for (const r of rows) await c.put(r.k, "x".repeat(r.size), ["t"], 1000, r.at); return { db, c }; };
  it("drops entries older than the age limit", async () => {
    const { c } = await seed([{ k: "old", size: 10, at: 100 }, { k: "new", size: 10, at: 9_000 }]);
    expect(await c.prune(10_000, { maxAgeMs: 5_000, maxBytes: 1e6 })).toBe(1);
    expect(await c.get("old")).toBeNull(); expect(await c.get("new")).not.toBeNull();
  });
  it("then drops the OLDEST entries until the payloads fit", async () => {
    const { c } = await seed([{ k: "a", size: 40, at: 1 }, { k: "b", size: 40, at: 2 }, { k: "c", size: 40, at: 3 }]);
    expect(await c.prune(10, { maxAgeMs: 1e9, maxBytes: 90 })).toBe(1);
    expect(await c.get("a")).toBeNull(); expect(await c.get("b")).not.toBeNull(); expect(await c.get("c")).not.toBeNull();
  });
  it("does nothing when everything fits", async () => {
    const { c } = await seed([{ k: "a", size: 5, at: 1 }]); expect(await c.prune(10, { maxAgeMs: 1e9, maxBytes: 1e6 })).toBe(0);
  });
});

describe("realtime", () => {
  it("catches up on every reconnect but not on the first connection", () => {
    const f = jest.fn(); const t = createReconnectTracker(f);
    t("CHANNEL_ERROR"); t("SUBSCRIBED"); expect(f).not.toHaveBeenCalled();
    t("CLOSED"); t("SUBSCRIBED"); expect(f).toHaveBeenCalledTimes(1);
    t("SUBSCRIBED"); expect(f).toHaveBeenCalledTimes(2);
  });
  it("listens to the tables the backend publishes, including check-in denials and refunds", () => {
    const names = REALTIME_TABLES.map((t) => t.table);
    expect(names).toEqual(expect.arrayContaining(["notifications", "user_roles", "class_messages", "class_sessions", "attendance", "checkin_denials", "refunds"]));
  });
});
