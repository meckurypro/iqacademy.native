// Paying in the app, pure part (no native imports, so it is unit-tested).
// The flow: the server starts a Paystack payment and gives us a page address -> we show it in the in-app browser -> when the person comes back we ask the server
// whether the money arrived. The payment function only accepts a return address on the web site's own domain (anything else is silently replaced by a page the
// signed-out payment window cannot show), so we ask for the web site's /pay/return page, which hands the person straight back to the app. The app does not trust that
// page for anything: it always asks the server what happened once the payment window closes.
export type PayStatus = "succeeded" | "failed" | "pending";
/** The two addresses a payment needs. `callbackUrl` is where Paystack sends the browser afterwards: the web site's own /pay/return page (it bounces into the app); undefined when the
 *  site's address is not configured, in which case the server uses its default. `redirectUrl` is the app's own address, which the payment window watches for so it can close itself. */
export function payReturn(webBaseUrl: string | undefined, appReturnUrl: string) {
  const base = webBaseUrl?.trim().replace(/\/+$/, "");
  return { callbackUrl: base ? `${base}/pay/return` : undefined, redirectUrl: appReturnUrl };
}

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

export { functionErrorKey } from "@/data/fnError";
