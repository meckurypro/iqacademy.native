// Server-corrected clock glue: injects the RPC into the shared time lib, restores the last skew, and measures again on demand.
import { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { kv } from "./kv";
import { supabase } from "./supabase";
import { clockSkewMs, setClockSkew, syncClock } from "@/shared/web/time";
import { setServerNowFetcher } from "@/shared/clockSource";

const KEY = "clock.skew";
let wired = false;
export function wireClock() {
  if (wired) return; wired = true;
  setServerNowFetcher(async () => { const r = await supabase.rpc("server_now"); return { data: r.data, error: r.error }; });
  const saved = kv.getJson<{ ms: number }>(KEY);
  if (saved && Number.isFinite(saved.ms)) setClockSkew(saved.ms);
}

/** Measure now and remember the result. Returns null when offline (the last stored skew keeps being used). */
export async function measureClock() {
  wireClock();
  const ms = await syncClock();
  if (ms != null) kv.setJson(KEY, { ms });
  return ms;
}

/** Web parity: while signed in, wait (at most 2.5 s) for the first measurement, then re-measure every 10 min and whenever the app returns to the foreground. */
export function useClockSync(enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [skew, setSkew] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const go = async () => { const ms = await measureClock(); if (alive) { setSkew(ms ?? clockSkewMs()); setReady(true); } };
    const cap = setTimeout(() => alive && setReady(true), 2500);
    go();
    const iv = setInterval(go, 10 * 60 * 1000);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") go(); });
    return () => { alive = false; clearTimeout(cap); clearInterval(iv); sub.remove(); setReady(false); };
  }, [enabled]);
  return { ready: enabled ? ready : false, skew };
}

// Phone-clock drift, shared with the shell so ClockNotice can warn about it.
export const ClockSkewContext = createContext(0);
export const useClockSkew = () => useContext(ClockSkewContext);
