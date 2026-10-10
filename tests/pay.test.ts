import { functionErrorKey, pollPayment, waitForForeground, type AppStateLike } from "@/features/enrol/pay";

const noSleep = async () => {};
describe("pollPayment", () => {
  it("stops as soon as the server says succeeded or failed", async () => {
    const v = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce("pending").mockResolvedValueOnce("succeeded");
    expect(await pollPayment(v, "ref", { sleep: noSleep })).toBe("succeeded"); expect(v).toHaveBeenCalledTimes(3);
    expect(await pollPayment(async () => "failed", "ref", { sleep: noSleep })).toBe("failed");
  });
  it("treats errors as 'not yet' and ends 'pending' after the last try, sleeping between tries only", async () => {
    const sleep = jest.fn(async () => {}); const v = jest.fn().mockRejectedValue(new Error("net"));
    expect(await pollPayment(v, "ref", { tries: 3, gapMs: 10, sleep })).toBe("pending"); expect(v).toHaveBeenCalledTimes(3); expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe("waitForForeground", () => {
  const fake = (start: string) => {
    let cb: (s: string) => void = () => {}; const timers: { fn: () => void; ms: number; id: number; live: boolean }[] = []; let removed = false;
    const app: AppStateLike = { currentState: start, addEventListener: (_e, c) => { cb = c; return { remove: () => { removed = true; } }; } };
    const setT = ((fn: () => void, ms: number) => { const t = { fn, ms, id: timers.length, live: true }; timers.push(t); return t.id as never; }) as unknown as typeof setTimeout;
    const clearT = ((id: number) => { const t = timers[id]; if (t) t.live = false; }) as unknown as typeof clearTimeout;
    return { app, setT, clearT, emit: (s: string) => cb(s), fire: (ms: number) => timers.filter((t) => t.live && t.ms === ms).forEach((t) => t.fn()), removed: () => removed };
  };
  it("waits for background then foreground", async () => {
    const f = fake("active"); let done = false;
    const p = waitForForeground(f.app, { setT: f.setT, clearT: f.clearT }).then(() => { done = true; });
    f.emit("active"); await Promise.resolve(); expect(done).toBe(false); // still here: the browser has not taken over yet
    f.emit("background"); f.emit("active"); await p; expect(done).toBe(true); expect(f.removed()).toBe(true);
  });
  it("does not wait forever if the browser never opened", async () => {
    const f = fake("active"); const p = waitForForeground(f.app, { startGraceMs: 4000, maxMs: 99999, setT: f.setT, clearT: f.clearT });
    f.fire(4000); await p; expect(f.removed()).toBe(true);
  });
  it("if the app is already in the background it only waits for the return", async () => {
    const f = fake("background"); const p = waitForForeground(f.app, { setT: f.setT, clearT: f.clearT });
    f.fire(4000); f.emit("active"); await p; // grace timer does not end the wait early because we had already left
  });
});

describe("functionErrorKey", () => {
  it("prefers the body's error key, then the response body on a failed call, then the message", async () => {
    expect(await functionErrorKey(null, { error: "instalment_not_payable" })).toBe("instalment_not_payable");
    expect(await functionErrorKey({ context: { json: async () => ({ error: "pay_earlier_instalment_first" }) } }, null)).toBe("pay_earlier_instalment_first");
    expect(await functionErrorKey({ message: "boom" }, null)).toBe("boom");
    expect(await functionErrorKey({ context: { json: async () => { throw new Error("x"); } }, message: "m" }, null)).toBe("m");
    expect(await functionErrorKey(null, null)).toBe("payment_failed");
  });
});
