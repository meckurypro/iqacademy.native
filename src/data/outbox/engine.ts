// The outbox: user actions that are safe to perform later. Survives app kills (it lives in the encrypted DB), keeps order inside a scope,
// backs off on failure, gives up on errors that retrying cannot fix, and never blocks one scope because another is stuck.
import { isNetworkError } from "@/core/errors";
import type { OutboxRepo, OutboxRow, Counts } from "../db/outboxRepo";

export type Handler = (payload: never, row: OutboxRow) => Promise<void>;
export type Verdict = "retry" | "fatal";
export type OutboxDeps = {
  repo: OutboxRepo; handlers: Record<string, Handler>; isOnline: () => boolean; now: () => number;
  onDone: (tags: string[]) => void; newId: () => string;
  classify?: (e: unknown) => Verdict; maxAttempts?: number;
};
export const MAX_ATTEMPTS = 8;
export const backoffMs = (attempts: number) => Math.min(2000 * 2 ** Math.max(0, attempts - 1), 5 * 60_000);
const status = (e: unknown) => Number((e as { status?: number } | null)?.status ?? 0);
/** Network trouble and 5xx/429 are worth retrying. A rule the server enforced (it raised an error for this exact request) will fail again, so it is not. */
export const defaultClassify = (e: unknown): Verdict => (isNetworkError(e) || status(e) >= 500 || status(e) === 429 ? "retry" : "fatal");

export function createOutbox(d: OutboxDeps) {
  const max = d.maxAttempts ?? MAX_ATTEMPTS, classify = d.classify ?? defaultClassify;
  let counts: Counts = { pending: 0, failed: 0, dead: 0 };
  let running: Promise<void> | null = null, again = false;
  const subs = new Set<() => void>();
  const refresh = async () => { const c = await d.repo.counts(); if (c.pending !== counts.pending || c.failed !== counts.failed || c.dead !== counts.dead) { counts = c; subs.forEach((f) => f()); } };

  async function pass(): Promise<boolean> { // returns false to stop (offline / network down)
    if (!d.isOnline()) return false;
    const rows = await d.repo.due(d.now());
    if (!rows.length) return false;
    for (const row of rows) {
      const h = d.handlers[row.kind];
      if (!h) { await d.repo.dead(row.id, `no handler for "${row.kind}"`); continue; }
      await d.repo.markSending(row.id);
      try { await h(row.payload as never, row); await d.repo.done(row.id); d.onDone(row.tags); }
      catch (e) {
        const msg = String((e as { message?: string })?.message ?? e).slice(0, 300);
        if (classify(e) === "retry" && row.attempts + 1 < max) { await d.repo.retryLater(row.id, msg, d.now() + backoffMs(row.attempts + 1)); if (isNetworkError(e)) { await refresh(); return false; } }
        else await d.repo.dead(row.id, msg);
      }
      await refresh();
    }
    return true;
  }

  return {
    async enqueue(kind: string, payload: unknown, o: { scope?: string; tags?: string[] } = {}) {
      const id = d.newId();
      await d.repo.enqueue(id, kind, payload, o.scope ?? "default", o.tags ?? [], d.now());
      await refresh();
      return id;
    },
    /** Send everything that is due. Calls made while a flush is running are folded into one extra pass. */
    flush(): Promise<void> {
      if (running) { again = true; return running; }
      running = (async () => {
        try { do { again = false; while (await pass()) { /* keep draining while progress is made */ } } while (again); }
        finally { running = null; await refresh(); }
      })();
      return running;
    },
    async start() { await d.repo.resetSending(); await refresh(); },
    snapshot: () => counts,
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    refresh,
    list: () => d.repo.list(),
    revive: async (id: string) => { await d.repo.revive(id); await refresh(); },
    discard: async (id: string) => { await d.repo.discard(id); await refresh(); },
  };
}
export type Outbox = ReturnType<typeof createOutbox>;
