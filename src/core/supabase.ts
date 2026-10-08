// The ONE place the Supabase client is created. Only src/core and src/data may import this (ESLint enforces it).
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { chunkedSecureStorage } from "./secure";

export const supabase = createClient(env.supabaseUrl || "http://localhost:54321", env.supabaseAnonKey || "missing-anon-key", {
  auth: {
    storage: chunkedSecureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // there is no URL bar; deep links are handled by core/authUrl.ts
    flowType: env.authFlow,
  },
});

export type SupabaseClient = typeof supabase;

let installed = false;
/** Supabase's React Native guidance: refresh tokens only while the app is in the foreground. Call once at start-up. */
export function installAuthLifecycle() {
  if (installed) return; installed = true;
  const sync = (s: string) => { if (s === "active") supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh(); };
  sync(AppState.currentState);
  AppState.addEventListener("change", sync);
}
