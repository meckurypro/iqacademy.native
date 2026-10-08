// One shared channel for the user-scoped tables. Rows arrive already filtered by row-level security, so a student only hears about their own world.
// Screens that need something narrower (one class's attendance, one chat) use useRealtime() instead.
import type { SupabaseClient } from "@/core/supabase";

export function startRealtime(sb: SupabaseClient, uid: string, invalidateSoon: (tags: string[]) => void) {
  const on = (table: string, tags: string[], filter?: string, event: "*" | "INSERT" | "DELETE" = "*") => ({ table, tags, filter, event });
  const subs = [
    on("notifications", ["notifications"], `user_id=eq.${uid}`),
    on("user_roles", ["roles"], `user_id=eq.${uid}`),
    on("class_messages", ["messages"], undefined, "INSERT"),
    on("class_sessions", ["sessions"]),
    on("attendance", ["attendance", "messages"]),
  ];
  let ch = sb.channel(`iqa-global-${uid}`);
  for (const s of subs) ch = ch.on("postgres_changes" as never, { event: s.event, schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) } as never, () => invalidateSoon(s.tags));
  ch.subscribe();
  return () => { sb.removeChannel(ch); };
}
