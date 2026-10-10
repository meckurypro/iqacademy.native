// Pieces the centre-staff screens share: one database call per branch (cached as ONE entry), and the "All branches" chip row.
import { useQuery } from "@/data";
import { friendly } from "@/core/errors";
import { place } from "@/shared/web/centre";
import { Chip, ChipRow } from "@/ui";
import type { StaffCentre } from "./useStaffCentres";

export type PerCentre<T> = { id: string; data: T | null; err: string | null };

/** `name(p_centre_id)` for every branch in `ids`, in parallel. A branch that fails carries its own readable message; the others still show. */
export function useEachRpc<T>(name: string, ids: string[], tags: string[], ttlMs = 60_000) {
  const q = useQuery<PerCentre<T>[]>({
    key: ["each", name, ids], enabled: ids.length > 0, tags, ttlMs,
    fn: async (sb) => Promise.all(ids.map(async (id) => { const r = await sb.rpc(name, { p_centre_id: id }); return { id, data: (r.data as T) ?? null, err: r.error ? friendly(r.error) : null }; })),
  });
  return { ...q, data: ids.length ? q.data : ([] as PerCentre<T>[]) };
}

/** "All branches" plus one chip per branch. Hidden when there is only one. */
export function BranchChips({ centres, sel, setSel, all = true }: { centres: Pick<StaffCentre, "id" | "name" | "city" | "address">[] | undefined; sel: string; setSel: (id: string) => void; all?: boolean }) {
  const items = [...(all ? [{ id: "all", name: "All branches" }] : []), ...(centres ?? []).map((c) => ({ id: c.id, name: place(c) }))];
  return <ChipRow>{items.map((c) => <Chip key={c.id} on={sel === c.id} onPress={() => setSel(c.id)}>{c.name}</Chip>)}</ChipRow>;
}
