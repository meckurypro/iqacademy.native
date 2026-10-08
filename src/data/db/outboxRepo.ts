import { tagString } from "./cacheRepo";
import type { Db } from "./types";

export type OutboxStatus = "pending" | "sending" | "failed" | "dead";
export type OutboxRow = { seq: number; id: string; kind: string; payload: unknown; scope: string; tags: string[]; status: OutboxStatus; attempts: number; last_error: string | null; next_attempt_at: number; created_at: number };
type Raw = Omit<OutboxRow, "payload" | "tags"> & { payload: string; tags: string };
const parse = (r: Raw): OutboxRow => ({ ...r, payload: JSON.parse(r.payload), tags: r.tags.split("|").filter(Boolean) });
export type Counts = { pending: number; failed: number; dead: number };

export function createOutboxRepo(db: Db) {
  return {
    enqueue: (id: string, kind: string, payload: unknown, scope: string, tags: string[], at: number) =>
      db.run("INSERT INTO outbox (id, kind, payload, scope, tags, status, created_at, next_attempt_at) VALUES (?,?,?,?,?,'pending',?,0)", [id, kind, JSON.stringify(payload), scope, tagString(tags), at]),
    /** The first live row of each scope (order inside a scope is preserved), if it is due. Dead rows never block a scope. */
    due: async (now: number) => (await db.all<Raw>(
      `SELECT o.* FROM outbox o WHERE o.status IN ('pending','failed') AND o.next_attempt_at <= ?
         AND NOT EXISTS (SELECT 1 FROM outbox p WHERE p.scope = o.scope AND p.seq < o.seq AND p.status IN ('pending','sending','failed'))
       ORDER BY o.seq`, [now])).map(parse),
    markSending: (id: string) => db.run("UPDATE outbox SET status='sending' WHERE id = ?", [id]),
    done: (id: string) => db.run("DELETE FROM outbox WHERE id = ?", [id]),
    retryLater: (id: string, error: string, nextAt: number) => db.run("UPDATE outbox SET status='failed', attempts = attempts + 1, last_error = ?, next_attempt_at = ? WHERE id = ?", [error, nextAt, id]),
    dead: (id: string, error: string) => db.run("UPDATE outbox SET status='dead', attempts = attempts + 1, last_error = ? WHERE id = ?", [error, id]),
    revive: (id: string) => db.run("UPDATE outbox SET status='pending', attempts = 0, last_error = NULL, next_attempt_at = 0 WHERE id = ?", [id]),
    discard: (id: string) => db.run("DELETE FROM outbox WHERE id = ?", [id]),
    /** After a crash or kill, rows left 'sending' go back to pending (handlers must be safe to repeat). */
    resetSending: () => db.run("UPDATE outbox SET status='pending' WHERE status='sending'"),
    counts: async (): Promise<Counts> => {
      const rows = await db.all<{ status: OutboxStatus; n: number }>("SELECT status, count(*) AS n FROM outbox GROUP BY status");
      const n = (s: OutboxStatus[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
      return { pending: n(["pending", "sending"]), failed: n(["failed"]), dead: n(["dead"]) };
    },
    list: async () => (await db.all<Raw>("SELECT * FROM outbox ORDER BY seq")).map(parse),
    clear: () => db.run("DELETE FROM outbox"),
  };
}
export type OutboxRepo = ReturnType<typeof createOutboxRepo>;
