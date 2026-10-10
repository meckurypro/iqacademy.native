// Port of web lib/auth.tsx. Same shape: { session, loading, roles, name, avatar, refresh } and the same helpers.
// Differences (intentional): roles/profile come through the data layer, so they are cached and available offline;
// `rolesReady` lets the shell wait for them instead of flashing the student home for a second.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useDataWarmup, useQuery } from "@/data";
import { ok } from "./errors";
import { useSession } from "./session";

export type Role = "student" | "coordinator" | "centre_director" | "instructor" | "admin" | "super_admin";
export type RoleRow = { role: Role; centre_id: string | null };
type Ctx = { session: Session | null; loading: boolean; roles: RoleRow[]; name: string; avatar: string | null; rolesReady: boolean; refresh: () => void };
const AuthCtx = createContext<Ctx>({ session: null, loading: true, roles: [], name: "", avatar: null, rolesReady: false, refresh: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const uid = session?.user.id;
  const r = useQuery<RoleRow[]>({ key: ["roles", uid], enabled: !!uid, tags: ["roles"], ttlMs: 10 * 60_000, fn: async (sb) => (ok(await sb.rpc("my_roles")) as RoleRow[]) ?? [] });
  const p = useQuery<{ full_name: string | null; avatar_url: string | null } | null>({
    key: ["profile", uid], enabled: !!uid, tags: ["profile"], ttlMs: 10 * 60_000,
    fn: async (sb) => ok(await sb.from("profiles").select("full_name,avatar_url").eq("id", uid!).maybeSingle()),
  });
  const { data: roleRows, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = r;
  const { data: profile, refetch: refetchProfile } = p;
  useDataWarmup(uid, roleRows ?? [], !!uid && roleRows !== undefined);
  const value = useMemo<Ctx>(() => ({
    session, loading,
    roles: roleRows ?? [],
    name: profile?.full_name ?? session?.user.email ?? "",
    avatar: profile?.avatar_url ?? null,
    rolesReady: !session || roleRows !== undefined || (!rolesLoading && rolesError != null),
    refresh: () => { refetchRoles(); refetchProfile(); },
  }), [session, loading, roleRows, rolesLoading, rolesError, profile, refetchRoles, refetchProfile]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const staffRank: Role[] = ["super_admin", "admin", "centre_director", "coordinator", "instructor"];
export const primaryRole = (roles: RoleRow[]): Role => staffRank.find((r) => roles.some((x) => x.role === r)) ?? "student";
export const roleLabel: Record<Role, string> = {
  student: "Student", coordinator: "Coordinator", centre_director: "Centre Director",
  instructor: "Instructor", admin: "Admin", super_admin: "Super Admin",
};
