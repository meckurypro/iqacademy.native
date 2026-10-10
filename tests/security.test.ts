// tests/security.test.ts
// M12 device security rules, M7a check-in wording and M13 door-PIN rule. Pure logic only: nothing here needs a phone.
import { DEFAULT_SETTINGS, STEP_UP_WINDOW_MS, classifyAuthError, parseSettings, shouldLockOnResume, stepUpNeeded } from "@/features/security/policy";
import { needsDoorPin } from "@/features/profile/doorPin";
import { deniedText } from "@/shared/checkin";
import { inboxLink } from "@/shared/verify";

describe("settings", () => {
  it("starts with the app lock off and money confirmation on", () => {
    expect(DEFAULT_SETTINGS).toEqual({ appLock: false, graceSec: 60, stepUp: true });
  });
  it("accepts a valid stored value", () => {
    expect(parseSettings({ appLock: true, graceSec: 300, stepUp: false })).toEqual({ appLock: true, graceSec: 300, stepUp: false });
  });
  it("falls back to defaults for damaged or unknown values", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ appLock: "yes", graceSec: 7, stepUp: 1 })).toEqual(DEFAULT_SETTINGS);
  });
});

describe("shouldLockOnResume", () => {
  const base = { enabled: true, now: 1_000_000, graceSec: 60 };
  it("never locks when the lock is off or the app was never left", () => {
    expect(shouldLockOnResume({ ...base, enabled: false, leftAt: 0 })).toBe(false);
    expect(shouldLockOnResume({ ...base, leftAt: null })).toBe(false);
  });
  it("stays open inside the grace time and locks at and after it", () => {
    expect(shouldLockOnResume({ ...base, leftAt: base.now - 59_000 })).toBe(false);
    expect(shouldLockOnResume({ ...base, leftAt: base.now - 60_000 })).toBe(true);
    expect(shouldLockOnResume({ ...base, leftAt: base.now - 10 * 60_000 })).toBe(true);
  });
  it("with no grace, locks every time", () => {
    expect(shouldLockOnResume({ ...base, graceSec: 0, leftAt: base.now })).toBe(true);
  });
  it("locks when the phone's clock was moved back while away", () => {
    expect(shouldLockOnResume({ ...base, leftAt: base.now + 5_000 })).toBe(true);
  });
});

describe("stepUpNeeded", () => {
  const now = 5_000_000;
  it("is never needed when switched off", () => { expect(stepUpNeeded({ enabled: false, lastOkAt: null, now })).toBe(false); });
  it("is needed with no recent confirmation", () => { expect(stepUpNeeded({ enabled: true, lastOkAt: null, now })).toBe(true); });
  it("covers the next action for two minutes, then asks again", () => {
    expect(stepUpNeeded({ enabled: true, lastOkAt: now - (STEP_UP_WINDOW_MS - 1), now })).toBe(false);
    expect(stepUpNeeded({ enabled: true, lastOkAt: now - STEP_UP_WINDOW_MS, now })).toBe(true);
  });
  it("asks again when the clock moved back", () => { expect(stepUpNeeded({ enabled: true, lastOkAt: now + 1000, now })).toBe(true); });
});

describe("classifyAuthError", () => {
  it("separates cancelling, a phone with nothing to check against, and a real failure", () => {
    expect(classifyAuthError("user_cancel")).toBe("cancelled");
    expect(classifyAuthError("system_cancel")).toBe("cancelled");
    expect(classifyAuthError("not_enrolled")).toBe("unavailable");
    expect(classifyAuthError("passcode_not_set")).toBe("unavailable");
    expect(classifyAuthError("authentication_failed")).toBe("failed");
    expect(classifyAuthError(undefined)).toBe("failed");
  });
});

describe("needsDoorPin (web lib/doorLock.ts)", () => {
  it("is for instructors and coordinators who are not admins", () => {
    expect(needsDoorPin([{ role: "instructor" }])).toBe(true);
    expect(needsDoorPin([{ role: "coordinator" }, { role: "student" }])).toBe(true);
    expect(needsDoorPin([{ role: "instructor" }, { role: "admin" }])).toBe(false);
    expect(needsDoorPin([{ role: "super_admin" }, { role: "coordinator" }])).toBe(false);
    expect(needsDoorPin([{ role: "student" }])).toBe(false);
    expect(needsDoorPin([{ role: "centre_director" }])).toBe(false);
  });
});

describe("check-in wording (web lib/checkin.ts)", () => {
  it("has red-screen text per reason and a safe default", () => {
    expect(deniedText("payment_required").title).toBe("Payment due");
    expect(deniedText("nope")).toEqual({ title: "Not allowed in", detail: "You can't join this class." });
  });
});

describe("inboxLink (web lib/verify.ts)", () => {
  it("opens the right inbox for common providers and nothing for others", () => {
    expect(inboxLink("ada@gmail.com")?.name).toBe("Gmail");
    expect(inboxLink("a@outlook.com")?.name).toBe("Outlook");
    expect(inboxLink("a@proton.me")?.name).toBe("Proton Mail");
    expect(inboxLink("a@company.ng")).toBeNull();
  });
});
