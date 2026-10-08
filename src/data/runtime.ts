// The per-user data runtime (engine + outbox + db), owned by <DataProvider>, reachable from plain functions (mutate, lifecycle).
import type { SupabaseClient } from "@/core/supabase";
import type { Outbox } from "./outbox/engine";
import type { QueryEngine } from "./query/engine";
import type { Db } from "./db/types";

export type Runtime = {
  uid: string | null; sb: SupabaseClient; engine: QueryEngine; outbox: Outbox | null; db: Db | null;
  /** True when the encrypted DB could not be opened: everything still works from memory, nothing is kept on disk. */
  degraded: boolean;
  /** Invalidate soon (coalesced): realtime bursts become one refresh. */
  invalidateSoon: (tags: string[]) => void;
  shutdown: () => Promise<void>;
};
let current: Runtime | null = null;
export const getRuntime = () => current;
export const setRuntime = (r: Runtime | null) => { current = r; };
