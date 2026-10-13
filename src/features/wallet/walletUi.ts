// Pure display rules for the instructor wallet. The money itself is never computed here: the database (instructor_wallet) decides.
// The wallet works exactly like a centre director's income: one record per month, a Withdraw button per month.
export type Tone = "ok" | "warn" | "bad" | "muted" | "info";
export const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Requested", tone: "info" },
  processing: { label: "On its way", tone: "info" },
  paid: { label: "Paid", tone: "ok" },
  failed: { label: "Didn't go through", tone: "bad" },
  rejected: { label: "Not approved", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "muted" },
};
export const statusInfo = (s: string) => STATUS[s] ?? { label: s, tone: "muted" as Tone };

export type MonthHint = "nothing" | "no_account" | "below_min" | "not_open" | "can_withdraw";
// What to tell the instructor under a month's Withdraw button, in priority order.
export const monthHint = (m: { available: number; can_withdraw: boolean }, w: { account?: { ready?: boolean } | null; min_payout: number }): MonthHint =>
  m.available <= 0 ? "nothing" : !w.account?.ready ? "no_account" : w.min_payout > m.available ? "below_min" : !m.can_withdraw ? "not_open" : "can_withdraw";

// Word-level name comparison, the same rule the server uses when it stores the "name matches" flag.
const words = (s: string) => (s || "").toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((x) => x.length > 1);
export const namesMatch = (accountName: string, profileName: string) => {
  const a = new Set(words(accountName)); const p = words(profileName);
  return p.length > 0 && p.filter((x) => a.has(x)).length >= Math.min(2, p.length);
};
