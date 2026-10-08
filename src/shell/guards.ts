// Role guard for routes (data in guards.generated.ts, from port/route-manifest.json). The database is the real gatekeeper; this only keeps people off screens that cannot work for them.
import { GUARDS } from "./guards.generated";

const toRe = (pat: string) => new RegExp("^" + pat.replace(/:[^/]+/g, "[^/]+") + "/?$");
/** `roles` = every role the user holds (web checks the same way). */
export function allowedHere(pathname: string, roles: string[]): boolean {
  for (const [pat, allowed] of Object.entries(GUARDS)) if (toRe(pat).test(pathname) && !roles.some((r) => allowed.includes(r))) return false;
  return true;
}
