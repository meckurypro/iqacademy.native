// Port of the web's useUserSearch (pages/Users.tsx): a search box whose results update as you type. Reads are cached for a short while.
import { useRpc } from "@/data";
import { useDebounced } from "@/shared/useDebounced";
import type { Role } from "@/core/auth";

export type UserRow = { id: string; full_name: string; email: string | null; avatar_url: string | null; is_active: boolean; roles: { role: Role; centre_id: string | null; centre_name: string | null }[] };

/** undefined while the first answer is on its way. */
export function useUserSearch(q: string) {
  const dq = useDebounced(q, 220);
  const r = useRpc<UserRow[]>("search_users", { p_query: dq, p_limit: 30 }, { tags: ["users", "roles"], ttlMs: 20_000 });
  return { rows: r.data, error: r.error, refetch: r.refetch, settled: dq === q };
}
