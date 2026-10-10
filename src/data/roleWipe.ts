// When someone's roles change (promoted, moved centre, made instructor), the lists cached for the old role must not linger:
// a director who becomes a student would otherwise open the app to a director's cached numbers for a moment.
// The outbox is NOT touched: unsent actions belong to the person, whatever role they hold now.
import type { RoleRow } from "@/core/auth";
import { createCacheRepo } from "./db/cacheRepo";
import { stableKey } from "./query/engine";
import type { Runtime } from "./runtime";

export type RoleChange = "first" | "same" | "changed";
export const roleSignature = (roles: Pick<RoleRow, "role" | "centre_id">[]) => [...new Set(roles.map((r) => `${r.role}@${r.centre_id ?? ""}`))].sort().join("|");
export const classifyRoleChange = (prev: string | null, next: string): RoleChange => (prev == null ? "first" : prev === next ? "same" : "changed");
/** The cache keys that say who the person is: they stay across a role change. */
export const identityKeys = (uid: string) => [stableKey(["roles", uid]), stableKey(["profile", uid])];

const KEY = "role.signature";
export async function applyRoleChange(rt: Pick<Runtime, "db" | "engine" | "uid">, roles: RoleRow[]): Promise<RoleChange> {
  const db = rt.db; if (!db || !rt.uid) return "first";
  const next = roleSignature(roles);
  const prev = (await db.first<{ v: string }>("SELECT v FROM kv WHERE k = ?", [KEY]))?.v ?? null;
  const change = classifyRoleChange(prev, next);
  if (change !== "same") await db.run("INSERT INTO kv (k, v, updated_at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at", [KEY, next, Date.now()]);
  if (change === "changed") { const keep = identityKeys(rt.uid); await createCacheRepo(db).clearExcept(keep); rt.engine.reset(keep); }
  return change;
}
