// Connectivity. Port of web lib/online.ts (web 64bc5f7), adapted to React Native.
// "Online" = the phone has a network link AND our own backend answers. A Wi-Fi link with no internet is the common failure, so the link flag
// is only a hint: we also ask the backend (/auth/v1/health). ANY reply, even an error status, means reachable; only a network failure means not.
// Two failed asks in a row are needed before we say offline, so one slow moment never flashes a warning; we ask more often while offline so the
// notice clears fast. The ask pauses while the app is in the background (battery, mobile data) and runs again when it returns.
// (ADR-016: this replaces ADR-006. NetInfo's own reachability probe is still ignored; ours targets OUR server, not a third-party URL.)
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { env } from "@/core/env";

export const CALM_MS = 20_000, RETRY_MS = 4_000, TIMEOUT_MS = 6_000;

export type NetDeps = {
  /** Can we reach the backend right now? (true = got any reply) */
  probe: () => Promise<boolean>;
  /** Subscribe to link changes. cb(true|false) = link up/down. Returns unsubscribe. */
  onLink: (cb: (up: boolean) => void) => () => void;
  /** Subscribe to foreground/background. cb(true) = foreground. Returns unsubscribe. */
  onForeground: (cb: (fg: boolean) => void) => () => void;
  setTimer: (f: () => void, ms: number) => unknown;
  clearTimer: (t: unknown) => void;
};

export function createNetMonitor(d: NetDeps) {
  let link: boolean | null = null;   // null = unknown, treated as up
  let reach = true;                  // result of our probe (optimistic until proven otherwise)
  let fails = 0, timer: unknown, running = false, fg = true, last = true, token = 0;
  const subs = new Set<() => void>();
  const isOnline = () => link !== false && reach;
  const emit = () => { const now = isOnline(); if (now !== last) { last = now; subs.forEach((f) => f()); } };

  const check = async () => {
    d.clearTimer(timer); const mine = ++token;
    const ok = link === false ? false : await d.probe();
    if (!running || mine !== token) return; // stopped, or a newer check superseded this one
    fails = ok ? 0 : fails + 1;
    if (ok) reach = true; else if (fails >= 2 || link === false) reach = false;
    emit();
    if (fg) timer = d.setTimer(check, ok ? CALM_MS : RETRY_MS);
  };

  const unsubs: (() => void)[] = [];
  return {
    isOnline,
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    checkNow: () => { if (running) void check(); },
    start() {
      if (running) return () => this.stop();
      running = true;
      unsubs.push(d.onLink((up) => {
        if (up) { link = true; void check(); }
        else { link = false; fails = 2; reach = false; emit(); d.clearTimer(timer); if (fg) timer = d.setTimer(check, RETRY_MS); } // lost: say so at once, then keep asking
      }));
      unsubs.push(d.onForeground((now) => { fg = now; if (now) void check(); else { d.clearTimer(timer); token++; } }));
      void check();
      return () => this.stop();
    },
    stop() { running = false; token++; d.clearTimer(timer); unsubs.splice(0).forEach((u) => u()); },
    /** Tests only. */
    __set(l: boolean | null, r = true) { link = l; reach = r; fails = r ? 0 : 2; emit(); },
  };
}

// ---- the app's monitor ----
const serverProbe = async () => {
  if (!env.supabaseUrl) return true;
  const stop = new AbortController(); const t = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try { await fetch(`${env.supabaseUrl}/auth/v1/health`, { cache: "no-store", signal: stop.signal }); return true; }
  catch { return false; }
  finally { clearTimeout(t); }
};

const monitor = createNetMonitor({
  probe: serverProbe,
  onLink: (cb) => NetInfo.addEventListener((s) => cb(s.isConnected !== false)),
  onForeground: (cb) => { const sub = AppState.addEventListener("change", (s) => cb(s === "active")); return () => sub.remove(); },
  setTimer: (f, ms) => setTimeout(f, ms),
  clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
});

export const isOnline = monitor.isOnline;
export const subscribeNet = monitor.subscribe;
export const useOnline = () => useSyncExternalStore(monitor.subscribe, monitor.isOnline, monitor.isOnline);
/** Start watching (idempotent). Returns a stop function. Call once at app start (DataProvider does). */
export const startNetWatch = () => monitor.start();
/** Ask the backend again right now (e.g. after the person taps Refresh). */
export const checkNetNow = monitor.checkNow;
/** Tests only. */
export const __setOnline = (v: boolean | null) => monitor.__set(v, v !== false);
