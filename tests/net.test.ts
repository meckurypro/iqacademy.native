import { CALM_MS, RETRY_MS, createNetMonitor, type NetDeps } from "@/data/net";

// A controllable world: the probe answers from `server`, timers are fake, link/foreground events are triggered by hand.
const world = () => {
  const w = { server: true, probes: 0, link: null as null | ((u: boolean) => void), fg: null as null | ((f: boolean) => void) };
  const deps: NetDeps = {
    probe: async () => { w.probes++; return w.server; },
    onLink: (cb) => { w.link = cb; return () => { w.link = null; }; },
    onForeground: (cb) => { w.fg = cb; return () => { w.fg = null; }; },
    setTimer: (f, ms) => setTimeout(f, ms), clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  };
  return { w, m: createNetMonitor(deps) };
};
const tick = async (ms: number) => { await jest.advanceTimersByTimeAsync(ms); };

describe("net monitor (web lib/online.ts semantics)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("starts optimistic and stays online while the server answers", async () => {
    const { m } = world(); m.start(); expect(m.isOnline()).toBe(true); await tick(CALM_MS * 3); expect(m.isOnline()).toBe(true);
  });

  it("needs TWO failed asks in a row before saying offline (one slow moment never flashes a warning)", async () => {
    const { w, m } = world(); m.start(); await tick(0); const seen: boolean[] = []; m.subscribe(() => seen.push(m.isOnline()));
    w.server = false; await tick(CALM_MS);            // 1st failure
    expect(m.isOnline()).toBe(true);
    await tick(RETRY_MS);                               // 2nd failure, asked sooner while failing
    expect(m.isOnline()).toBe(false); expect(seen).toEqual([false]);
  });

  it("a single failure followed by a success never reports offline", async () => {
    const { w, m } = world(); m.start(); await tick(0); w.server = false; await tick(CALM_MS); w.server = true; await tick(RETRY_MS); await tick(CALM_MS * 2);
    expect(m.isOnline()).toBe(true);
  });

  it("asks more often while offline so the notice clears quickly, then relaxes", async () => {
    const { w, m } = world(); m.start(); await tick(0); w.server = false; await tick(CALM_MS + RETRY_MS); expect(m.isOnline()).toBe(false);
    w.server = true; await tick(RETRY_MS); expect(m.isOnline()).toBe(true);
    const before = w.probes; await tick(CALM_MS); expect(w.probes - before).toBe(1); // calm cadence again
  });

  it("losing the network link is reported at once, without waiting for probes", async () => {
    const { w, m } = world(); m.start(); await tick(0); w.link!(false); expect(m.isOnline()).toBe(false);
    const p = w.probes; await tick(RETRY_MS * 3); expect(w.probes).toBe(p);          // no probing without a link
    w.link!(true); await tick(0); expect(m.isOnline()).toBe(true);                  // link back + server answers
  });

  it("link up but server unreachable (Wi-Fi with no internet) is offline", async () => {
    const { w, m } = world(); m.start(); await tick(0); w.server = false; w.link!(true); await tick(RETRY_MS * 2); expect(m.isOnline()).toBe(false);
  });

  it("pauses while the app is in the background and checks again on return", async () => {
    const { w, m } = world(); m.start(); await tick(0); w.fg!(false); const p = w.probes; await tick(CALM_MS * 5); expect(w.probes).toBe(p);
    w.fg!(true); await tick(0); expect(w.probes).toBe(p + 1);
  });

  it("stop() ends everything", async () => {
    const { w, m } = world(); m.start(); await tick(0); m.stop(); const p = w.probes; await tick(CALM_MS * 5); expect(w.probes).toBe(p); expect(w.link).toBeNull();
  });
});
