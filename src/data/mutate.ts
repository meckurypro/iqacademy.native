// Every change the app makes goes through here, so offline behaviour is decided in ONE place (policies.ts).
import { randomUUID } from "expo-crypto";
import { friendly, ok, UserMessage } from "@/core/errors";
import { supabase, type SupabaseClient } from "@/core/supabase";
import { isOnline } from "./net";
import { policyFor, prepareQueued } from "./policies";
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
    const q = prepareQueued(pol, args, randomUUID);
    const id = await rt.outbox.enqueue("rpc", { name, args: q.args }, { scope: q.scope, tags: [...pol.invalidates, ...(opts.invalidates ?? [])] });
    await rt.outbox.flush();
    const row = (await rt.outbox.list()).find((r) => r.id === id);
    if (!row) return { status: "done", data: undefined as T };
    // The server looked at this exact request and refused it (not allowed, too long, class not open...). Retrying cannot help, so say so now instead of hiding it in a queue.
    if (row.status === "dead") { await rt.outbox.discard(id); throw new UserMessage(friendlyQueued(row.last_error)); }
    return { status: "queued", id };
  }
  const data = await online(async (sb) => ok(await sb.rpc(name, args ?? {})) as T, opts);
  return { status: "done", data };
}
export const mutate = { rpc: mutateRpc, online };

const friendlyQueued = (m: string | null) => (m && m.trim() ? friendly(new Error(m)) : "That could not be sent.");
