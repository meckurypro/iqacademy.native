// What may happen to each RPC when the phone is offline. Default for anything not listed: ONLINE-ONLY (safe).
// Rule of thumb (port/PLAN.md §4): anything the server decides (time windows, eligibility, prices, money, roles) is online-only.
// Queue only actions that are idempotent or harmless to repeat, and whose result the user does not need to see immediately.
export type Args = Record<string, unknown>;
export type Policy =
  | { mode: "online" }
  | {
      mode: "queue";
      /** Rows in one scope are sent in order. A function lets one RPC keep a separate order per chat/class. */
      scope: string | ((args: Args) => string);
      invalidates: string[];
      /** Name of an argument the server uses to ignore a repeat of the same request. Filled in ONCE when the action is queued, so every retry carries the same id. */
      clientIdArg?: string;
      /** Short wording for the "Pending" screen. */
      label?: string;
    };

export const RPC_POLICIES: Record<string, Policy> = {
  mark_notifications_read: { mode: "queue", scope: "notifications", invalidates: ["notifications"], label: "Mark notifications read" },
  mark_channel_read: { mode: "queue", scope: "channel-read", invalidates: ["messages"], label: "Mark chat read" },
  // Safe to repeat since backend migration 57: send_class_message(p_client_id) returns the existing row when the same (sender, client id) arrives again.
  send_class_message: {
    mode: "queue", scope: (a) => `chat:${String(a.p_session_id ?? "")}`, invalidates: ["messages"], clientIdArg: "p_client_id", label: "Send class message",
  },
};
export const policyFor = (rpc: string): Policy => RPC_POLICIES[rpc] ?? { mode: "online" };

/** Work out the scope and arguments for a queued call. The client id is generated here, once, and reused by every retry. */
export function prepareQueued(pol: Extract<Policy, { mode: "queue" }>, args: Args | undefined, newId: () => string): { scope: string; args: Args } {
  const a: Args = { ...(args ?? {}) };
  if (pol.clientIdArg && (a[pol.clientIdArg] == null || a[pol.clientIdArg] === "")) a[pol.clientIdArg] = newId();
  return { scope: typeof pol.scope === "function" ? pol.scope(a) : pol.scope, args: a };
}
export const labelFor = (rpc: string) => { const p = RPC_POLICIES[rpc]; return (p && p.mode === "queue" && p.label) || "Saved change"; };
