import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { ok } from "@/core/errors";
import type { SupabaseClient } from "@/core/supabase";
import { useRuntime } from "../DataProvider";
import { isOnline, useOnline } from "../net";
import { stableKey } from "./engine";

export type UseQueryOpts<T> = {
  /** Anything JSON-able that identifies this query (name + args). */
  key: unknown;
  /** Do the fetch. Receives the client; return the data (use ok() for { data, error } results). Screens never import the client themselves. */
  fn: (sb: SupabaseClient) => Promise<T>;
  /** What this data depends on (e.g. "notifications", "class:<id>"). A server change with a matching tag refreshes it. */
  tags?: string[];
  /** Younger than this and not invalidated → no network call. Default 60 s. */
  ttlMs?: number;
  enabled?: boolean;
};
export const DEFAULT_TTL_MS = 60_000;

export function useQuery<T>(o: UseQueryOpts<T>) {
  const rt = useRuntime(); const { engine } = rt;
  const key = stableKey(o.key); const enabled = o.enabled !== false;
  const tags = o.tags ?? []; const tagKey = tags.join("|"); const ttl = o.ttlMs ?? DEFAULT_TTL_MS;
  const fnRef = useRef(o.fn);
  useEffect(() => { fnRef.current = o.fn; }); // always the latest closure; runs before the ensure effect below
  const online = useOnline();

  const state = useSyncExternalStore(useCallback((cb) => engine.subscribe(key, cb), [engine, key]), () => engine.getState(key));
  useEffect(() => {
    if (!enabled) return;
    engine.ensure(key, { fn: () => fnRef.current(rt.sb), tags: tagKey ? tagKey.split("|") : [], ttlMs: ttl });
  }, [engine, rt.sb, key, enabled, tagKey, ttl]);

  const refetch = useCallback(() => engine.fetch(key), [engine, key]);
  return {
    data: state.data as T | undefined,
    error: state.data === undefined ? state.error : null,
    /** Nothing to show yet. */
    loading: enabled && (state.status === "idle" || (state.status === "loading" && state.data === undefined)),
    /** Showing cached data while a fresh copy loads. */
    refreshing: state.fetching && state.data !== undefined,
    /** Showing data that is older than it should be (offline, or a refresh failed). */
    stale: state.data !== undefined && (state.stale || !online || state.error != null),
    updatedAt: state.updatedAt,
    offline: !online,
    refetch,
  };
}

/** A cached database function call. Result is typed by the caller. */
export function useRpc<T = unknown>(name: string, args?: Record<string, unknown>, opts: Omit<UseQueryOpts<T>, "key" | "fn"> = {}) {
  return useQuery<T>({ ...opts, key: ["rpc", name, args ?? {}], fn: async (sb) => ok(await sb.rpc(name, args ?? {})) as T });
}
export { isOnline };
