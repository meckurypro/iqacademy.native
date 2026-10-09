// One shared channel for the user-scoped tables. Rows arrive already filtered by row-level security, so a student only hears about their own world.
// Screens that need something narrower (one class's attendance, one chat) use useRealtime() instead.
// Two behaviours matter on a phone: the socket is closed while the app is in the background (no battery drain, the OS would kill it anyway), and
// every time it (re)connects after the first time we refresh what is on screen, because events sent while we were away are never replayed.
import { AppState } from "react-native";
import type { SupabaseClient } from "@/core/supabase";

export const REALTIME_TABLES = [
  { table: "notifications", tags: ["notifications"], own: "user_id", event: "*" },
  { table: "user_roles", tags: ["roles"], own: "user_id", event: "*" },
  { table: "class_messages", tags: ["messages"], event: "INSERT" },
  { table: "class_sessions", tags: ["sessions"], event: "*" },
  { table: "attendance", tags: ["attendance", "messages"], event: "*" },
  { table: "checkin_denials", tags: ["checkins", "attendance"], event: "*" },
  { table: "refunds", tags: ["payments", "refunds"], event: "*" },
] as const;

type Status = string;
/** Pure bookkeeping for "did we just come back?": the first SUBSCRIBED is a normal start, every later one is a reconnect that needs a catch-up. */
export function createReconnectTracker(onReconnect: () => void) {
  let seen = false;
  return (status: Status) => { if (status !== "SUBSCRIBED") return; if (seen) onReconnect(); seen = true; };
}

export function startRealtime(sb: SupabaseClient, uid: string, invalidateSoon: (tags: string[]) => void, onResync: () => void = () => {}) {
  let ch: ReturnType<SupabaseClient["channel"]> | null = null, stopped = false;
  const track = createReconnectTracker(onResync);
  const open = () => {
    if (ch || stopped) return;
    let c = sb.channel(`iqa-global-${uid}`);
    for (const s of REALTIME_TABLES) {
      const filter = "own" in s ? `${s.own}=eq.${uid}` : undefined;
      c = c.on("postgres_changes" as never, { event: s.event, schema: "public", table: s.table, ...(filter ? { filter } : {}) } as never, () => invalidateSoon([...s.tags]));
    }
    c.subscribe((status: Status) => track(status));
    ch = c;
  };
  const close = () => { if (ch) { sb.removeChannel(ch); ch = null; } };
  open();
  const sub = AppState.addEventListener("change", (s) => { if (s === "active") { const wasClosed = !ch; open(); if (wasClosed) onResync(); } else if (s === "background") close(); });
  return () => { stopped = true; sub.remove(); close(); };
}
