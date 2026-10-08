// Narrow, per-screen realtime (e.g. one class's attendance). Invalidates tags instead of handing rows to the screen, so the cache stays the single source.
import { useEffect } from "react";
import { useRuntime } from "./DataProvider";

export function useRealtime(o: { table: string; filter?: string; event?: "*" | "INSERT" | "UPDATE" | "DELETE"; tags: string[]; enabled?: boolean }) {
  const rt = useRuntime(); const tagKey = o.tags.join("|");
  useEffect(() => {
    if (o.enabled === false) return;
    const ch = rt.sb.channel(`rt-${o.table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes" as never, { event: o.event ?? "*", schema: "public", table: o.table, ...(o.filter ? { filter: o.filter } : {}) } as never, () => rt.invalidateSoon(tagKey.split("|")))
      .subscribe();
    return () => { rt.sb.removeChannel(ch); };
  }, [rt, o.table, o.filter, o.event, o.enabled, tagKey]);
}
