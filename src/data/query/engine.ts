// Stale-while-revalidate query cache. Framework-free so it is unit-testable.
//   • memory first, then the encrypted SQLite cache, then the network
//   • fresh data (younger than ttl, not invalidated) is never re-fetched: saves mobile data
//   • offline: cached data stays on screen, marked stale; nothing is thrown away
//   • invalidate(tags) marks matching entries stale and re-fetches the ones a screen is watching
import type { CacheRepo } from "../db/cacheRepo";

export type QueryStatus = "idle" | "loading" | "success" | "error";
export type QueryState<T = unknown> = { data: T | undefined; error: unknown; status: QueryStatus; updatedAt: number | null; stale: boolean; fetching: boolean; fromCache: boolean };
export const IDLE: QueryState = { data: undefined, error: null, status: "idle", updatedAt: null, stale: false, fetching: false, fromCache: false };
/** `fn` receives what is already held for this key (undefined the first time), so a list can ask the server only for what changed since. */
export type Meta = { fn: (prev?: unknown) => Promise<unknown>; tags: string[]; ttlMs: number };
export type Deps = { cache: CacheRepo | null; now: () => number; isOnline: () => boolean };

export const stableKey = (parts: unknown): string => {
  const norm = (v: unknown): unknown => Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, norm(x)])) : v;
  return JSON.stringify(norm(parts));
};

export class QueryEngine {
  private states = new Map<string, QueryState>();
  private metas = new Map<string, Meta>();
  private subs = new Map<string, Set<() => void>>();
  private inflight = new Map<string, Promise<void>>();
  private hydrating = new Map<string, Promise<void>>();
  constructor(private deps: Deps) {}

  getState = (key: string): QueryState => this.states.get(key) ?? IDLE;

  subscribe = (key: string, cb: () => void) => {
    let s = this.subs.get(key); if (!s) this.subs.set(key, (s = new Set()));
    s.add(cb);
    return () => { s.delete(cb); };
  };
  private watching = (key: string) => (this.subs.get(key)?.size ?? 0) > 0;
  private set(key: string, patch: Partial<QueryState>) {
    this.states.set(key, { ...this.getState(key), ...patch });
    this.subs.get(key)?.forEach((f) => f());
  }
  private fresh(key: string) {
    const s = this.getState(key), m = this.metas.get(key);
    return s.status === "success" && !s.stale && s.updatedAt != null && !!m && this.deps.now() - s.updatedAt < m.ttlMs;
  }

  /** Called by a screen when it starts watching a key. Resolves when cache is loaded and any needed fetch has finished. */
  async ensure(key: string, meta: Meta): Promise<void> {
    this.metas.set(key, meta);
    await this.hydrate(key);
    if (this.fresh(key)) return;
    if (!this.deps.isOnline()) { if (this.getState(key).status === "loading") this.set(key, { status: this.getState(key).data === undefined ? "error" : "success", error: this.getState(key).data === undefined ? new Error("offline") : null }); return; }
    await this.fetch(key);
  }

  private hydrate(key: string): Promise<void> {
    if (this.getState(key).status !== "idle") return Promise.resolve();
    let p = this.hydrating.get(key);
    if (!p) {
      p = (async () => {
        this.set(key, { status: "loading" });
        const row = await this.deps.cache?.get(key).catch(() => null);
        if (row && this.getState(key).status === "loading") {
          try { this.set(key, { data: JSON.parse(row.payload), status: "success", updatedAt: row.fetched_at, stale: row.stale === 1, fromCache: true }); } catch { /* unreadable row: ignore */ }
        }
      })().finally(() => this.hydrating.delete(key));
      this.hydrating.set(key, p);
    }
    return p;
  }

  fetch(key: string): Promise<void> {
    const have = this.inflight.get(key); if (have) return have;
    const meta = this.metas.get(key); if (!meta) return Promise.resolve();
    this.set(key, { fetching: true });
    const p = (async () => {
      try {
        const data = await meta.fn(this.getState(key).data);
        const at = this.deps.now();
        this.set(key, { data, error: null, status: "success", updatedAt: at, stale: false, fetching: false, fromCache: false });
        this.deps.cache?.put(key, JSON.stringify(data ?? null), meta.tags, meta.ttlMs, at).catch(() => {});
      } catch (error) {
        const had = this.getState(key).data !== undefined;
        this.set(key, { error, fetching: false, status: had ? "success" : "error" }); // keep showing what we have
      } finally { this.inflight.delete(key); }
    })();
    this.inflight.set(key, p);
    return p;
  }

  /** A server-side change happened: mark everything carrying one of these tags stale, and refresh what is on screen. */
  invalidate(tags: string[]) {
    if (!tags.length) return;
    this.deps.cache?.markStale(tags).catch(() => {});
    for (const [key, m] of this.metas) {
      if (!m.tags.some((t) => tags.includes(t))) continue;
      if (this.getState(key).status === "idle") continue;
      this.set(key, { stale: true });
      if (this.watching(key) && this.deps.isOnline()) this.fetch(key);
    }
  }
  invalidateAll() {
    this.deps.cache?.markAllStale().catch(() => {});
    for (const key of this.metas.keys()) if (this.getState(key).status !== "idle") { this.set(key, { stale: true }); if (this.watching(key) && this.deps.isOnline()) this.fetch(key); }
  }
  /** App back in the foreground / connection restored: refresh anything on screen that is no longer fresh. */
  revalidateActive() {
    if (!this.deps.isOnline()) return;
    for (const key of this.metas.keys()) if (this.watching(key) && !this.fresh(key)) this.fetch(key);
  }
  /** Forget everything except the given keys (a role change: the old role's lists must not linger). Watched keys are fetched again straight away. */
  reset(keep: string[] = []) {
    const kept = new Set(keep);
    for (const key of [...this.states.keys()]) {
      if (kept.has(key)) continue;
      this.states.delete(key); this.hydrating.delete(key);
      this.subs.get(key)?.forEach((f) => f());
      if (this.watching(key) && this.deps.isOnline() && this.metas.has(key)) this.fetch(key);
    }
  }
  /** Local write-through (e.g. after an optimistic update). */
  setData<T>(key: string, data: T) { this.set(key, { data, status: "success", error: null, updatedAt: this.deps.now(), stale: false }); }
  get activeKeys() { return [...this.metas.keys()].filter((k) => this.watching(k)); }
}
