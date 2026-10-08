import { naira } from "@/shared/format";
import { friendly, isNetworkError, UserMessage } from "@/core/errors";
import { chunkedSecureStorage, safeKey } from "@/core/secure";
import { parseAuthUrl } from "@/core/authUrl";
import { generatePassword, isStrong, strength } from "@/shared/web/password";
import { doorState, deniedText, opensAt } from "@/shared/checkin";
import { phaseOf, spoken, splitMs } from "@/shared/classClock";
import { copyShareClosed, fileSize, mergeMessages, type ClassMessage } from "@/shared/messages";
import { getPending, setPending } from "@/shared/verify";
import { setClockSkew } from "@/shared/web/time";
import { kv } from "@/core/kv";

describe("naira", () => {
  it("matches the web's toLocaleString('en-NG') output", () => {
    for (const kobo of [0, 99, 100, 150000, 12345600, 99999999, 100000000, 123456789012]) {
      expect(naira(kobo)).toBe("₦" + (kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 }));
    }
  });
});

describe("errors", () => {
  it("knows React Native's offline wording", () => {
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
    expect(friendly(new TypeError("Network request failed"))).toBe("No internet connection. Check it and try again.");
  });
  it("passes UserMessage through and maps server keys", () => {
    expect(friendly(new UserMessage("Hello"))).toBe("Hello");
    expect(friendly(new Error("invalid_code"))).toBe("That code isn't right. Check it and try again.");
    expect(friendly({ code: "23505", message: "x" })).toMatch(/already exists/);
    expect(friendly(new Error("???"))).toBe("Something went wrong. Please try again.");
  });
});

describe("secure session storage", () => {
  it("round-trips a long value in chunks, shrinks cleanly and removes everything", async () => {
    const key = "sb-abc.def:auth/token";
    const big = JSON.stringify({ t: "x".repeat(5000), u: "é".repeat(300) });
    await chunkedSecureStorage.setItem(key, big);
    expect(await chunkedSecureStorage.getItem(key)).toBe(big);
    await chunkedSecureStorage.setItem(key, "small");
    expect(await chunkedSecureStorage.getItem(key)).toBe("small");
    await chunkedSecureStorage.removeItem(key);
    expect(await chunkedSecureStorage.getItem(key)).toBeNull();
    expect(safeKey(key)).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe("auth deep links", () => {
  it("parses implicit tokens, pkce codes and errors", () => {
    expect(parseAuthUrl("iqacademy://auth/callback#access_token=a&refresh_token=r&type=signup")).toMatchObject({ access: "a", refresh: "r", type: "signup" });
    expect(parseAuthUrl("iqacademy://auth/callback?code=abc")).toMatchObject({ code: "abc" });
    expect(parseAuthUrl("iqacademy://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid")).toMatchObject({ errorCode: "otp_expired" });
  });
});

describe("password", () => {
  it("generates strong passwords from a secure source", () => {
    for (let i = 0; i < 20; i++) { const p = generatePassword(); expect(p).toHaveLength(16); expect(isStrong(p)).toBe(true); }
    expect(strength("abc").level).toBeLessThan(strength(generatePassword()).level);
  });
});

describe("check-in window and class clock", () => {
  const start = "2026-10-05T08:00:00Z", end = "2026-10-05T10:00:00Z", t = Date.parse(start);
  it("door state", () => {
    expect(doorState(start, end, t - 31 * 60000)).toBe("early");
    expect(doorState(start, end, t - 30 * 60000)).toBe("open");
    expect(doorState(start, end, Date.parse(end) + 1)).toBe("ended");
    expect(opensAt(start)).toMatch(/\d/);
    expect(deniedText("payment_required").title).toBe("Payment due");
    expect(deniedText("zzz").title).toBe("Not allowed in");
  });
  it("phases and spoken durations", () => {
    expect(phaseOf({ start_at: start, end_at: end }, t - 3600000)).toBe("upcoming");
    expect(phaseOf({ start_at: start, end_at: end }, t - 10 * 60000)).toBe("checkin");
    expect(phaseOf({ start_at: start, end_at: end }, t + 60000)).toBe("live");
    expect(phaseOf({ start_at: start, end_at: end }, Date.parse(end))).toBe("over");
    expect(splitMs(90061000)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
    expect(spoken(2 * 86400000 + 4 * 3600000)).toBe("2 days 4 hours");
    expect(spoken(5000)).toBe("less than a minute");
  });
});

describe("messages", () => {
  const m = (id: string, at: string): ClassMessage => ({ id, session_id: "s", sender_label: "x", body: id, media_path: null, media_name: null, media_mime: null, media_size: null, created_at: at });
  it("merges by id in time order and closes the copy window by the server clock", () => {
    expect(mergeMessages([m("b", "2026-10-05T10:00:00Z")], [m("a", "2026-10-05T09:00:00Z"), m("b", "2026-10-05T10:00:00Z")]).map((x) => x.id)).toEqual(["a", "b"]);
    const real = Date.now; Date.now = () => Date.parse("2026-10-05T11:59:00Z"); setClockSkew(0);
    expect(copyShareClosed(m("a", "2026-10-05T10:00:00Z"))).toBe(false);
    setClockSkew(2 * 60000); // server is 2 min ahead of the phone → window closed
    expect(copyShareClosed(m("a", "2026-10-05T10:00:00Z"))).toBe(true);
    Date.now = real; setClockSkew(0);
    expect(fileSize(2048)).toBe("2 KB"); expect(fileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("pending verification", () => {
  it("remembers the email and expires after 24 h", () => {
    setPending("  A@B.com ");
    expect(getPending()?.email).toBe("a@b.com");
    kv.setJson("iq:pending-verify", { email: "a@b.com", at: Date.now() - 25 * 3600 * 1000 });
    expect(getPending()).toBeNull();
  });
});
