// M1 — device spikes. Each returns checks the person can read on the phone and paste into port/DECISIONS.md.
// They only run in dev/preview builds (env.devTools) and never touch real user data.
import * as SQLite from "expo-sqlite";
import { getRandomBytes } from "expo-crypto";
import { chunkedSecureStorage } from "@/core/secure";
import { parseAuthUrl } from "@/core/authUrl";
import { keyPragma, toHex } from "@/data/db/keys";
import { __forceTzStrategy, dayOf, dayStart, fromWallInput, toWallInput, tzStrategy } from "@/shared/web/time";
import { naira } from "@/shared/format";

export type Check = { id: string; title: string; status: "pass" | "fail" | "info"; detail: string };
const pass = (id: string, title: string, detail = ""): Check => ({ id, title, status: "pass", detail });
const fail = (id: string, title: string, detail: string): Check => ({ id, title, status: "fail", detail });
const info = (id: string, title: string, detail: string): Check => ({ id, title, status: "info", detail });
const eq = (id: string, title: string, got: unknown, want: unknown) => (JSON.stringify(got) === JSON.stringify(want) ? pass(id, title, String(got)) : fail(id, title, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

const INSTANTS = [Date.UTC(2026, 0, 1, 0, 30), Date.UTC(2026, 9, 4, 23, 30), Date.UTC(2026, 11, 31, 23, 59), Date.UTC(2026, 5, 15, 8, 5)];
// Lagos is UTC+1 all year: the expected values are computed by plain arithmetic, with no engine tz data involved.
const lagos = (t: number) => new Date(t + 3600000);
const p2 = (n: number) => String(n).padStart(2, "0");
const wantDay = (t: number) => { const d = lagos(t); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; };
const wantWall = (t: number) => { const d = lagos(t); return `${wantDay(t)}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };

/** S1 — does this JS engine know Africa/Lagos, and do the Intl features time.ts relies on exist? */
export async function s1Intl(): Promise<Check[]> {
  const out: Check[] = [];
  const hermes = !!(globalThis as { HermesInternal?: unknown }).HermesInternal;
  out.push(info("s1.engine", "JS engine", hermes ? "Hermes" : "not Hermes (JSC/V8?)"));
  out.push(info("s1.locale", "Device locale", (() => { try { return new Intl.DateTimeFormat().resolvedOptions().locale; } catch (e) { return `error: ${e}`; } })()));
  try {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" });
    out.push(eq("s1.tz", "Intl knows Africa/Lagos (00:30 UTC → 1:30 AM)", f.format(Date.UTC(2026, 0, 1, 0, 30)).replace(/\s/g, "\u202f"), "1:30\u202fAM"));
  } catch (e) { out.push(fail("s1.tz", "Intl knows Africa/Lagos", String(e))); }
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hourCycle: "h23" }).formatToParts(Date.UTC(2026, 0, 1, 23, 0));
    out.push(eq("s1.parts", "formatToParts + hourCycle h23 (23:00 UTC → 00 next day)", parts.find((x) => x.type === "hour")?.value, "00"));
  } catch (e) { out.push(fail("s1.parts", "formatToParts + hourCycle h23", String(e))); }
  try { out.push(eq("s1.enca", "en-CA gives YYYY-MM-DD", new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.UTC(2026, 9, 5)), "2026-10-05")); }
  catch (e) { out.push(fail("s1.enca", "en-CA gives YYYY-MM-DD", String(e))); }
  out.push(info("s1.ngnum", "toLocaleString('en-NG') (web's naira; native uses its own)", (() => { try { return (150000).toLocaleString("en-NG"); } catch (e) { return `error: ${e}`; } })()));
  out.push(eq("s1.naira", "naira(15000000) = ₦150,000", naira(15000000), "₦150,000"));
  // The app's own helpers, in both strategies, against arithmetic.
  const native = tzStrategy();
  out.push(info("s1.strategy", "time.ts chose", native === "intl" ? "intl (engine has Lagos data)" : "shifted (emulating Lagos: UTC+1)"));
  for (const mode of ["intl", "shifted"] as const) {
    try {
      __forceTzStrategy(mode);
      const bad = INSTANTS.filter((t) => dayOf(t) !== wantDay(t) || toWallInput(t) !== wantWall(t) || fromWallInput(wantWall(t)) !== Math.floor(t / 60000) * 60000);
      out.push(bad.length ? fail(`s1.app.${mode}`, `dayOf / toWallInput / fromWallInput (${mode})`, `mismatch at ${bad.map((t) => new Date(t).toISOString()).join(", ")}`) : pass(`s1.app.${mode}`, `dayOf / toWallInput / fromWallInput (${mode})`, `${INSTANTS.length} instants ok`));
      out.push(eq(`s1.start.${mode}`, `dayStart (${mode})`, dayStart("2026-10-05"), Date.parse("2026-10-05T00:00:00+01:00")));
    } catch (e) { out.push(fail(`s1.app.${mode}`, `app time helpers (${mode})`, String(e))); }
  }
  __forceTzStrategy(null);
  return out;
}

/** S3 (storage half) — SecureStore holds a session-sized value in chunks. The deep-link/session half needs a real email; see the spike screen. */
export async function s3Storage(): Promise<Check[]> {
  const out: Check[] = [];
  try {
    const big = JSON.stringify({ access_token: "a".repeat(1400), refresh_token: "r".repeat(60), user: { email: "x@y.z", meta: "é".repeat(800) } });
    await chunkedSecureStorage.setItem("spike-s3", big);
    out.push(eq("s3.roundtrip", `SecureStore round-trip of ${big.length} chars`, (await chunkedSecureStorage.getItem("spike-s3")) === big, true));
    await chunkedSecureStorage.removeItem("spike-s3");
    out.push(eq("s3.removed", "removed", await chunkedSecureStorage.getItem("spike-s3"), null));
  } catch (e) { out.push(fail("s3.secure", "SecureStore chunked round-trip", String(e))); }
  const p = parseAuthUrl("iqacademy://auth/callback#access_token=a&refresh_token=r&type=signup");
  out.push(eq("s3.parse", "deep-link fragment parsing", [p.access, p.refresh, p.type], ["a", "r", "signup"]));
  return out;
}

/** S4 — is SQLCipher really active, does the key gate access, and can we wipe? */
export async function s4SqlCipher(): Promise<Check[]> {
  const out: Check[] = [];
  const name = `spike-s4-${Date.now()}.db`, key = toHex(getRandomBytes(32)), wrong = toHex(getRandomBytes(32));
  const open = async (k: string | null) => { const db = await SQLite.openDatabaseAsync(name); if (k) await db.execAsync(keyPragma(k)); return db; };
  try {
    let db = await open(key);
    const v = await db.getFirstAsync<{ cipher_version?: string }>("PRAGMA cipher_version");
    out.push(v?.cipher_version ? pass("s4.cipher", "SQLCipher is active", `cipher_version ${v.cipher_version}`) : fail("s4.cipher", "SQLCipher is active", "PRAGMA cipher_version returned nothing: this build uses plain SQLite (is the dev client built with the expo-sqlite useSQLCipher plugin? Expo Go cannot do it)"));
    await db.execAsync("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('secret');");
    await db.closeAsync();

    db = await open(key);
    out.push(eq("s4.reopen", "reopen with the right key reads the row", (await db.getFirstAsync<{ v: string }>("SELECT v FROM t"))?.v, "secret"));
    await db.closeAsync();

    for (const [id, label, k] of [["s4.wrong", "wrong key is rejected", wrong], ["s4.nokey", "no key is rejected", null]] as const) {
      try { const d = await open(k); await d.getFirstAsync("SELECT count(*) FROM sqlite_master"); out.push(fail(id, label, "the encrypted file could be read")); await d.closeAsync(); }
      catch (e) { out.push(pass(id, label, String((e as Error).message ?? e).slice(0, 80))); }
    }
  } catch (e) { out.push(fail("s4.error", "SQLCipher spike", String(e))); }
  try { await SQLite.deleteDatabaseAsync(name); out.push(pass("s4.wipe", "database file deleted")); } catch (e) { out.push(fail("s4.wipe", "database file deleted", String(e))); }
  return out;
}
