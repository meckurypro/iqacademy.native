// Pure display rules for the instructor wallet. The money itself is never computed here: the database (instructor_wallet) decides.
export type Tone = "ok" | "warn" | "bad" | "muted";
export const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Waiting for approval", tone: "warn" },
  processing: { label: "On its way", tone: "warn" },
  paid: { label: "Paid", tone: "ok" },
  failed: { label: "Didn't go through", tone: "bad" },
  rejected: { label: "Not approved", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "muted" },
};
export type WithdrawState = "no_account" | "nothing" | "below_min" | "ready";
export const withdrawState = (w: { account: unknown; available: number; min_payout: number }): WithdrawState =>
  !w.account ? "no_account" : w.available <= 0 ? "nothing" : w.min_payout > w.available ? "below_min" : "ready";
export const statusInfo = (s: string) => STATUS[s] ?? { label: s, tone: "muted" as Tone };
// Bank names are matched on whole words the way the server does it, so the warning shown matches the flag the server stored.
const words = (s: string) => (s || "").toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((x) => x.length > 1);
export const namesMatch = (accountName: string, profileName: string) => {
  const a = new Set(words(accountName)); const p = words(profileName);
  return p.length > 0 && p.filter((x) => a.has(x)).length >= Math.min(2, p.length);
};
