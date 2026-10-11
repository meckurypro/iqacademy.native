import { DOOR_UNLOCK_MS, LOCKED, isUnlocked, unlockedState } from "@/features/class/doorLockCore";

describe("door lock", () => {
  const T = 1_000_000;
  it("starts locked, for everyone", () => { expect(isUnlocked(LOCKED, "u1", T)).toBe(false); expect(isUnlocked(LOCKED, undefined, T)).toBe(false); });
  it("unlocks for the same person for five minutes only", () => {
    const s = unlockedState("u1", T);
    expect(isUnlocked(s, "u1", T + 1)).toBe(true);
    expect(isUnlocked(s, "u1", T + DOOR_UNLOCK_MS - 1)).toBe(true);
    expect(isUnlocked(s, "u1", T + DOOR_UNLOCK_MS)).toBe(false);
  });
  it("is tied to the person: someone else on the same phone is still locked, and so is a signed-out phone", () => {
    const s = unlockedState("u1", T);
    expect(isUnlocked(s, "u2", T + 1)).toBe(false); expect(isUnlocked(s, undefined, T + 1)).toBe(false);
  });
  it("does not stay open if the clock is set backwards", () => { expect(isUnlocked(unlockedState("u1", T), "u1", T - 2 * DOOR_UNLOCK_MS)).toBe(false); });
});
