import { useEffect } from "react";
import type { RoleRow } from "@/core/auth";
import { useRuntime } from "./DataProvider";
import { useOnline } from "./net";
import { prefetchPlan, runPrefetch } from "./prefetch";
import { applyRoleChange, roleSignature } from "./roleWipe";

/** After sign-in (and whenever the roles change or the connection returns): clear the old role's cached lists if the role changed, then warm the cache. */
export function useDataWarmup(uid: string | undefined, roles: RoleRow[], ready: boolean) {
  const rt = useRuntime(); const online = useOnline(); const sig = roleSignature(roles);
  useEffect(() => {
    if (!uid || !ready || rt.uid !== uid) return;
    let live = true;
    (async () => {
      try { await applyRoleChange(rt, roles); } catch (e) { console.warn("[data] role check failed", e); }
      if (live && online) await runPrefetch(rt.engine, rt.sb, prefetchPlan(roles), () => live);
    })();
    return () => { live = false; };
    // `roles` is covered by `sig`; the runtime is rebuilt when the user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ready, sig, online, rt]);
}
