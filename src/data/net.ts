// Connectivity. Only an explicit "not connected" counts as offline. We deliberately ignore NetInfo's isInternetReachable: its probe URL can be
// blocked on some networks, which would wrongly lock people out of online-only actions. A request that really fails is handled where it fails.
import { useSyncExternalStore } from "react";
import NetInfo from "@react-native-community/netinfo";

let online: boolean | null = null; // null = not known yet (treated as online)
const subs = new Set<() => void>();
const set = (v: boolean) => { if (v !== online) { online = v; subs.forEach((f) => f()); } };

export const isOnline = () => online !== false;
export const subscribeNet = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const useOnline = () => useSyncExternalStore(subscribeNet, isOnline, isOnline);
export const startNetWatch = () => NetInfo.addEventListener((s) => set(s.isConnected !== false));
/** Tests only. */
export const __setOnline = (v: boolean | null) => { online = v; subs.forEach((f) => f()); };
