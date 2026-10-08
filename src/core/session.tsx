// The Supabase auth session as React state. Roles/profile live in core/auth.tsx (they need the data layer).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { installAuthLifecycle, supabase } from "./supabase";

type Ctx = { session: Session | null; loading: boolean; /** last auth event, e.g. PASSWORD_RECOVERY */ event: AuthChangeEvent | null };
const SessionCtx = createContext<Ctx>({ session: null, loading: true, event: null });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>({ session: null, loading: true, event: null });
  useEffect(() => {
    installAuthLifecycle(); // refresh tokens only while the app is in the foreground (idempotent)
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setState((s) => ({ ...s, session: data.session, loading: false })); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => { if (alive) setState({ session, loading: false, event }); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return <SessionCtx.Provider value={state}>{children}</SessionCtx.Provider>;
}
