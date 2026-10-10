// Port of web lib/useStaffCentres.ts. The branches the signed-in director or coordinator works at. `sel` is one branch id, or "all".
// The list of branches is cached (it changes when roles change), so these screens open offline.
import { useMemo, useState } from "react";
import { useAuth } from "@/core/auth";
import { ok } from "@/core/errors";
import { useQuery } from "@/data";

export type StaffCentre = { id: string; name: string; city: string | null; address: string | null };

export function useStaffCentres() {
  const { roles } = useAuth();
  const ids = useMemo(() => [...new Set(roles.filter((r) => (r.role === "centre_director" || r.role === "coordinator") && r.centre_id).map((r) => r.centre_id as string))].sort(), [roles]);
  const isDirector = roles.some((r) => r.role === "centre_director");
  const [sel, setSel] = useState("all");
  const q = useQuery<StaffCentre[]>({
    key: ["staffCentres", ids], enabled: ids.length > 0, tags: ["centres", "roles"], ttlMs: 10 * 60_000,
    fn: async (sb) => (ok(await sb.from("centres").select("id,name,city,address").in("id", ids).order("name")) as StaffCentre[]) ?? [],
  });
  const centres: StaffCentre[] | undefined = ids.length ? q.data : [];
  const shown = useMemo(() => (sel === "all" ? ids : ids.filter((i) => i === sel)), [ids, sel]);
  return { ids, shown, centres, sel, setSel, isDirector };
}
