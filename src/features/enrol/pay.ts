// Paying in the app, pure part (no native imports, so it is unit-tested).
// The flow: the server starts a Paystack payment and gives us a page address -> we show it in the in-app browser -> when the person comes back we ask the server
// whether the money arrived. The payment function only accepts a return address on the web site's own domain, so the browser lands on the web "payment received"
// page; the app does not depend on that page, it simply asks the server (same check the web page makes) once the browser closes.
export type PayStatus = "succeeded" | "failed" | "pending";
const sleepReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Ask up to `tries` times, `gapMs` apart: the bank can take a moment. Unknown answers and errors count as "not yet". */
export async function pollPayment(verify: (reference: string) => Promise<string | undefined>, reference: string, o: { tries?: number; gapMs?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<PayStatus> {
  const tries = o.tries ?? 6, gap = o.gapMs ?? 2500, sleep = o.sleep ?? sleepReal;
  for (let i = 0; i < tries; i++) {
    const s = await verify(reference).catch(() => undefined);
    if (s === "succeeded") return "succeeded";
    if (s === "failed") return "failed";
    if (i < tries - 1) await sleep(gap);
  }
  return "pending";
}

export type AppStateLike = { currentState: string; addEventListener: (e: "change", cb: (s: string) => void) => { remove: () => void } };
/** Android opens the browser and returns at once, so wait until the app has gone to the background and come back. Gives up after `maxMs`. */
export function waitForForeground(app: AppStateLike, o: { maxMs?: number; startGraceMs?: number; setT?: typeof setTimeout; clearT?: typeof clearTimeout } = {}): Promise<void> {
  const setT = o.setT ?? setTimeout, clearT = o.clearT ?? clearTimeout;
  return new Promise((resolve) => {
    let left = app.currentState !== "active"; // already in the background: just wait for the return
    let sub: { remove: () => void } | null = null;
    const done = () => { clearT(t1); clearT(t2); sub?.remove(); resolve(); };
    sub = app.addEventListener("change", (s) => { if (s !== "active") left = true; else if (left) done(); });
    const t1 = setT(() => { if (!left) done(); }, o.startGraceMs ?? 4000); // the browser never opened: do not wait forever
    const t2 = setT(done, o.maxMs ?? 20 * 60_000);
  });
}

/** What the payment function / Supabase returned when it refused, as a message key friendly() understands. */
export async function functionErrorKey(error: unknown, data: unknown): Promise<string> {
  const d = data as { error?: string } | null;
  if (d?.error) return d.error;
  try { const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context; const j = await ctx?.json?.(); if (j?.error) return j.error; } catch { /* body not readable */ }
  return (error as { message?: string } | null)?.message ?? "payment_failed";
}
