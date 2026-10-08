// Signing out: warn about unsent changes, let modules clean up (e.g. unregister the push token), close and DELETE this user's encrypted DB, then end the session.
import { supabase } from "@/core/supabase";
import type { ConfirmOpts } from "@/ui/feedback";
import { wipeUserDb } from "./db/userDb";
import { getRuntime } from "./runtime";

const hooks = new Set<() => Promise<void> | void>();
/** Register work that must happen before the session ends (M11a: unregister push token). Returns an unregister function. */
export const onBeforeSignOut = (fn: () => Promise<void> | void) => { hooks.add(fn); return () => { hooks.delete(fn); }; };

export async function signOutAndWipe(confirm: (o: ConfirmOpts) => Promise<boolean>): Promise<boolean> {
  const rt = getRuntime();
  const c = rt?.outbox?.snapshot(); const unsent = (c?.pending ?? 0) + (c?.failed ?? 0);
  if (unsent > 0 && !(await confirm({ title: "Sign out with unsent changes?", message: `${unsent} change${unsent === 1 ? " hasn't" : "s haven't"} been sent yet and will be lost if you sign out.`, confirmLabel: "Sign out", danger: true }))) return false;
  for (const h of hooks) { try { await h(); } catch (e) { console.warn("[signout hook]", e); } }
  const uid = rt?.uid;
  await rt?.shutdown();
  await supabase.auth.signOut(); // auth-js 2.117 removes the local session even if the server call fails (offline sign-out works)
  if (uid) await wipeUserDb(uid);
  return true;
}
