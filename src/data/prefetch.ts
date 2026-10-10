// First-launch warm-up: right after sign-in, fetch the lists each role's home screens open with, so a first look while offline shows content
// instead of an empty screen. Uses the same cache keys as useRpc(name, args), so screens get the result with no extra request.
// Failures are ignored (this is a courtesy, never an error). Only runs online; the engine skips anything already fresh.
import { ok } from "@/core/errors";
import type { RoleRow } from "@/core/auth";
import type { SupabaseClient } from "@/core/supabase";
import type { QueryEngine } from "./query/engine";
import { stableKey } from "./query/engine";

export type PrefetchItem = { name: string; args: Record<string, unknown>; tags: string[]; ttlMs: number };
const MIN = 60_000;
const item = (name: string, tags: string[], ttlMs: number, args: Record<string, unknown> = {}): PrefetchItem => ({ name, args, tags, ttlMs });

export function prefetchPlan(roles: Pick<RoleRow, "role" | "centre_id">[]): PrefetchItem[] {
  const has = (r: RoleRow["role"]) => roles.some((x) => x.role === r);
  const staff = has("admin") || has("super_admin") || has("centre_director") || has("coordinator") || has("instructor");
  const out: PrefetchItem[] = [item("unread_notification_count", ["notifications"], 5 * MIN)];
  if (!staff) out.push(item("my_class_channels", ["messages"], 5 * MIN), item("my_offline_payments", ["payments"], 5 * MIN), item("my_pending_review", ["reviews"], 10 * MIN));
  if (has("instructor")) out.push(item("instructor_dashboard", ["sessions"], 5 * MIN), item("instructor_class_channels", ["messages"], 5 * MIN));
  if (has("admin") || has("super_admin")) out.push(item("admin_overview", ["sessions", "payments"], 5 * MIN));
  const centres = [...new Set(roles.filter((r) => (r.role === "centre_director" || r.role === "coordinator") && r.centre_id).map((r) => r.centre_id as string))];
  for (const c of centres) out.push(item("centre_students", ["students", `centre-${c}`], 10 * MIN, { p_centre_id: c }));
  for (const c of new Set(roles.filter((r) => r.role === "centre_director" && r.centre_id).map((r) => r.centre_id as string))) out.push(item("centre_dashboard", ["sessions", "payments", `centre-${c}`], 5 * MIN, { p_centre_id: c }));
  return out;
}

/** Two at a time, so a slow server is not hit with a burst and the screen the person is looking at is not starved. */
export async function runPrefetch(engine: Pick<QueryEngine, "ensure">, sb: Pick<SupabaseClient, "rpc">, plan: PrefetchItem[], isLive: () => boolean = () => true, concurrency = 2) {
  let i = 0;
  const worker = async () => {
    while (i < plan.length && isLive()) {
      const p = plan[i++];
      try { await engine.ensure(stableKey(["rpc", p.name, p.args]), { fn: async () => ok(await sb.rpc(p.name, p.args)), tags: p.tags, ttlMs: p.ttlMs }); } catch { /* a courtesy fetch: ignore */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, plan.length) }, worker));
}
