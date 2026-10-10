import { isExpoPushToken, pushState, registerArgs } from "@/native/pushArgs";
import { deleteErrorMessage } from "@/features/profile/deleteAccount";
import { functionErrorKey } from "@/data/fnError";

jest.mock("@/data", () => ({ invokeFunction: jest.fn(), signOutAndWipe: jest.fn() }));

describe("push registration", () => {
  const tok = "ExponentPushToken[abc123_-XYZ]";
  it("accepts Expo tokens only", () => {
    expect(isExpoPushToken(tok)).toBe(true); expect(isExpoPushToken("ExpoPushToken[x]")).toBe(true);
    for (const bad of ["", "fcm:abc", "ExponentPushToken[]", "ExponentPushToken[a", null, 42, `ExponentPushToken[${"a".repeat(250)}]`]) expect(isExpoPushToken(bad)).toBe(false);
  });
  it("builds the database call, with reminders still coming from the server", () => {
    expect(registerArgs({ token: tok, platform: "android", appVersion: "1.0.0", deviceName: "Pixel" })).toEqual({ p_token: tok, p_platform: "android", p_device_name: "Pixel", p_app_version: "1.0.0", p_local_reminders: false });
    expect(registerArgs({ token: tok, platform: "ios" }).p_device_name).toBeNull();
  });
  it("refuses a bad token or platform before calling the server", () => {
    expect(() => registerArgs({ token: "nope", platform: "ios" })).toThrow("invalid_push_token");
    expect(() => registerArgs({ token: tok, platform: "web" })).toThrow("invalid_push_token");
  });
  it("states: unavailable without a project id, blocked when denied, on only when allowed AND registered", () => {
    const base = { permission: "granted" as const, hasProject: true, registered: true };
    expect(pushState(base)).toBe("on"); expect(pushState({ ...base, hasProject: false })).toBe("unavailable");
    expect(pushState({ ...base, permission: "denied" })).toBe("blocked"); expect(pushState({ ...base, registered: false })).toBe("off");
    expect(pushState({ ...base, permission: "undetermined", registered: false })).toBe("off");
  });
});

describe("account deletion messages", () => {
  it("words the server's refusals plainly", () => {
    expect(deleteErrorMessage(new Error("admin_cannot_delete"))).toContain("Ask another admin");
    expect(deleteErrorMessage(new Error("delete_incomplete"))).toContain("try again");
    expect(deleteErrorMessage(new Error("delete_failed"))).toContain("try again");
  });
  it("reads the key out of a failed function call", async () => {
    expect(await functionErrorKey({ context: { json: async () => ({ error: "admin_cannot_delete" }) } }, null)).toBe("admin_cannot_delete");
  });
});
