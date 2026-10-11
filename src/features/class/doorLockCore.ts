// Pure rules of the door lock (port of web lib/doorLock.ts), kept free of React and native modules so they can be unit-tested.
// Door tools (the class code / QR, checking a student in by hand) sit behind the staff member's own door PIN. The PIN itself is checked on the server.
export const DOOR_UNLOCK_MS = 5 * 60 * 1000;
export type DoorLock = { owner: string; until: number };
export const LOCKED: DoorLock = { owner: "", until: 0 };
/** What `unlockDoor(uid)` stores: tied to that person, good for five minutes. */
export const unlockedState = (uid: string, at: number): DoorLock => ({ owner: uid, until: at + DOOR_UNLOCK_MS });
/** Unlocked only for the same person, and only until the time runs out. A clock that moved backwards by more than the window does not extend it. */
export const isUnlocked = (s: DoorLock, uid: string | undefined, at: number) => !!uid && s.owner === uid && at < s.until && s.until - at <= DOOR_UNLOCK_MS;
