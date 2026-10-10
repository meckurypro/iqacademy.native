// The data layer's public surface. Screens import from "@/data": never from @supabase/supabase-js or @/core/supabase (ESLint enforces it).
export { DataProvider, useRuntime } from "./DataProvider";
export { useQuery, useRpc, useDeltaQuery, DEFAULT_TTL_MS, type UseQueryOpts } from "./query/hooks";
export { mergeRows, refreshDelta, type DeltaSpec, type DeltaBox } from "./query/delta";
export { useRealtime } from "./useRealtime";
export { useOutbox } from "./useOutbox";
export { mutate, mutateRpc, online, OFFLINE_TEXT, type Mutation } from "./mutate";
export { useOnline, isOnline } from "./net";
export { signOutAndWipe, onBeforeSignOut } from "./lifecycle";
export { getRuntime } from "./runtime";
export { RPC_POLICIES, policyFor } from "./policies";
export type { SupabaseClient as Sb } from "@/core/supabase";
export { useDataWarmup } from "./useWarmup";
export { prefetchPlan, runPrefetch } from "./prefetch";
export { roleSignature, classifyRoleChange } from "./roleWipe";
export { invokeFunction } from "./fn";
export { functionErrorKey } from "./fnError";
export { queueUpload } from "./stage";
export { receiptJob, avatarJob, MAX_RECEIPT, type UploadJob } from "./uploads";
