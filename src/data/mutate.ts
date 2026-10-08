// Every change the app makes goes through here, so offline behaviour is decided in ONE place (policies.ts).
import { ok, UserMessage } from "@/core/errors";
import { supabase, type SupabaseClient } from "@/core/supabase";
import { isOnline } from "./net";
import { policyFor } from "./policies";
import { getRuntime } from "./runtime";

export const OFFLINE_TEXT = "No internet connection. Check it and try again.";
export type Mutation<T> = { status: "done"; data: T } | { status: "queued"; id: string };

/** Run something that needs the server right now. Offline → a readable error instead of a hang. Invalidates the given tags on success. */
export async function online<T>(fn: (sb: SupabaseClient) => Promise<T>, opts: { invalidates?: string[] } = {}): Promise<T> {
  if (!isOnline()) throw new UserMessage(OFFLINE_TEXT);
  const out = await fn(supabase);
  if (opts.invalidates?.length) getRuntime()?.engine.invalidate(opts.invalidates);
  return out;
}

/** Call a database function. Policy decides: online-only (default) or queue-when-offline. */
export async function mutateRpc<T = unknown>(name: string, args?: Record<string, unknown>, opts: { invalidates?: string[] } = {}): Promise<Mutation<T>> {
  const pol = policyFor(name), rt = getRuntime();
  if (pol.mode === "queue" && rt?.outbox) {
    const id = await rt.outbox.enqueue("rpc", { name, args: args ?? {} }, { scope: pol.scope, tags: [...pol.invalidates, ...(opts.invalidates ?? [])] });
    await rt.outbox.flush();
    const still = (await rt.outbox.list()).some((r) => r.id === id);
    return still ? { status: "queued", id } : { status: "done", data: undefined as T };
  }
  const data = await online(async (sb) => ok(await sb.rpc(name, args ?? {})) as T, opts);
  return { status: "done", data };
}
export const mutate = { rpc: mutateRpc, online };
