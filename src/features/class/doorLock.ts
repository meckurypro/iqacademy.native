// Port of web lib/doorLock.ts. Unlocked state lives in memory only: it ends after five minutes, the moment the app goes to the background (web: tab hidden), on a restart, and
// for a different signed-in person (it is tied to the user id). Admins are not asked: they have their own override with a written reason (`needsDoorPin` is false for them).
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { now } from "@/shared/web/time";
import { LOCKED, isUnlocked, unlockedState, type DoorLock } from "./doorLockCore";

export { DOOR_UNLOCK_MS } from "./doorLockCore";
export { needsDoorPin } from "@/features/profile/doorPin";

let state: DoorLock = LOCKED; let timer: ReturnType<typeof setTimeout> | undefined; let watching = false;
const subs = new Set<() => void>(); const emit = () => subs.forEach((f) => f());

export function lockDoor() { state = LOCKED; clearTimeout(timer); emit(); }
export function unlockDoor(uid: string) {
  state = unlockedState(uid, now());
  clearTimeout(timer); timer = setTimeout(lockDoor, state.until - now() + 50);
  if (!watching) { watching = true; AppState.addEventListener("change", (s) => { if (s === "background") lockDoor(); }); }
  emit();
}
export const useDoorUnlocked = (uid: string | undefined) => useSyncExternalStore(
  (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
  () => isUnlocked(state, uid, now()),
);
