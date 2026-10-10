// src/features/security/stepUp.ts
// Ask the person to prove it is them again before a sensitive action. M10c (admin money) calls this before approving or declining a payment,
// recording a payout or sending a refund:
//
//   if (!(await requireStepUp("Approve this payment"))) return;   // cancelled or failed: do nothing
//
// It resolves true when the switch is off, when the person confirmed (or unlocked the app) in the last two minutes, or when the phone has no screen lock at all
// (nothing to check against, and the settings screen says so). Biometrics here is local protection on top of the server's own rules; it never replaces them.
import { authenticate, getCapability } from "@/native/biometrics";
import { stepUpNeeded } from "./policy";
import { getSettings } from "./settings";

let lastOkAt: number | null = null;
/** Called by the app lock after a successful unlock, so unlocking and then approving a payment does not ask twice. */
export const markStrongAuth = () => { lastOkAt = Date.now(); };
export const clearStrongAuth = () => { lastOkAt = null; };

export async function requireStepUp(reason: string): Promise<boolean> {
  if (!stepUpNeeded({ enabled: getSettings().stepUp, lastOkAt, now: Date.now() })) return true;
  const cap = await getCapability();
  if (!cap.enrolled) return true;
  const r = await authenticate(reason);
  if (r.ok) { markStrongAuth(); return true; }
  return false;
}
