// The cache key of an RPC read. `useRpc` and the first-launch prefetch BOTH use this, so what the prefetch warms is exactly what the screen later reads.
// (A helper with its own key shape, like the staff `useEachRpc` which uses ["each", name, ids], must be warmed by calling that helper's own key builder, not this one.)
export const rpcKey = (name: string, args?: Record<string, unknown>) => ["rpc", name, args ?? {}] as const;
