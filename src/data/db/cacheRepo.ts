import type { Db } from "./types";

const SAFE_TAG = /^[\w:.-]+$/; // tags go into LIKE patterns: no wildcards allowed
export const tagString = (tags: string[]) => {
  for (const t of tags) if (!SAFE_TAG.test(t)) throw new Error(`bad cache tag "${t}"`);
  return tags.length ? `|${tags.join("|")}|` : "";
};
export type CacheRow = { payload: string; tags: string; fetched_at: number; ttl_ms: number; stale: number };

export function createCacheRepo(db: Db) {
  return {
    get: (key: string) => db.first<CacheRow>("SELECT payload, tags, fetched_at, ttl_ms, stale FROM cache_entries WHERE key = ?", [key]),
    put: (key: string, payload: string, tags: string[], ttlMs: number, at: number) =>
      db.run("INSERT INTO cache_entries (key, payload, tags, fetched_at, ttl_ms, stale) VALUES (?,?,?,?,?,0) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, tags=excluded.tags, fetched_at=excluded.fetched_at, ttl_ms=excluded.ttl_ms, stale=0",
        [key, payload, tagString(tags), at, ttlMs]),
    markStale: async (tags: string[]) => {
      if (!tags.length) return;
      await db.run(`UPDATE cache_entries SET stale = 1 WHERE ${tags.map(() => "tags LIKE ?").join(" OR ")}`, tags.map((t) => { tagString([t]); return `%|${t}|%`; }));
    },
    markAllStale: () => db.run("UPDATE cache_entries SET stale = 1"),
    purgeOlderThan: (ms: number, now: number) => db.run("DELETE FROM cache_entries WHERE fetched_at < ?", [now - ms]),
    clear: () => db.run("DELETE FROM cache_entries"),
  };
}
export type CacheRepo = ReturnType<typeof createCacheRepo>;
