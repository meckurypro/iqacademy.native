// PORT-OF web src/lib/verify.ts @0081e66 — localStorage → kv. Remembers which email we're waiting on so the verify screen survives an app restart.
import { kv } from "@/core/kv";

const KEY = "iq:pending-verify";
const TTL = 24 * 3600 * 1000;
export type Pending = { email: string; at: number };

export const setPending = (email: string) => kv.setJson(KEY, { email: email.trim().toLowerCase(), at: Date.now() } satisfies Pending);
export const clearPending = () => kv.remove(KEY);
export function getPending(): Pending | null {
  const p = kv.getJson<Pending>(KEY);
  if (!p || Date.now() - p.at > TTL) { clearPending(); return null; }
  return p;
}

// Shortcut to the inbox for the common providers.
export function inboxLink(email: string): { name: string; url: string } | null {
  const d = email.split("@")[1]?.toLowerCase() ?? "";
  if (/^(gmail|googlemail)\.com$/.test(d)) return { name: "Gmail", url: "https://mail.google.com/mail/u/0/#inbox" };
  if (/^(outlook|hotmail|live|msn)\./.test(d)) return { name: "Outlook", url: "https://outlook.live.com/mail/0/inbox" };
  if (/^yahoo\./.test(d) || d === "ymail.com") return { name: "Yahoo Mail", url: "https://mail.yahoo.com/" };
  if (/^(icloud|me|mac)\.com$/.test(d)) return { name: "iCloud Mail", url: "https://www.icloud.com/mail" };
  if (d === "proton.me" || d === "protonmail.com") return { name: "Proton Mail", url: "https://mail.proton.me/" };
  return null;
}
