// What may happen to each RPC when the phone is offline. Default for anything not listed: ONLINE-ONLY (safe).
// Rule of thumb (port/PLAN.md §4): anything the server decides (time windows, eligibility, prices, money, roles) is online-only.
// Queue only actions that are idempotent or harmless to repeat, and whose result the user does not need to see immediately.
export type Policy = { mode: "online" } | { mode: "queue"; scope: string; invalidates: string[] };

export const RPC_POLICIES: Record<string, Policy> = {
  mark_notifications_read: { mode: "queue", scope: "notifications", invalidates: ["notifications"] },
  mark_channel_read: { mode: "queue", scope: "channel-read", invalidates: ["messages"] },
  // send_class_message is deliberately NOT queued yet: a retry after a lost response would post twice until the server accepts a client id (backend change B3).
};
export const policyFor = (rpc: string): Policy => RPC_POLICIES[rpc] ?? { mode: "online" };
