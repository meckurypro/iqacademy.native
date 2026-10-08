// One encrypted database file per signed-in user. Switching accounts never exposes the previous user's cache or unsent actions.
import * as SQLite from "expo-sqlite";
import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto";
import { kv } from "@/core/kv";
import { wrapExpoDb } from "./expo";
import { getOrCreateDbKey, keyPragma } from "./keys";
import { migrate } from "./migrations";
import type { Db } from "./types";

const NAMES = "db.names";
const remember = (n: string) => { const l = kv.getJson<string[]>(NAMES) ?? []; if (!l.includes(n)) kv.setJson(NAMES, [...l, n]); };
export const dbFileName = async (userId: string) => `iqa-${(await digestStringAsync(CryptoDigestAlgorithm.SHA256, userId)).slice(0, 16)}.db`;

async function openAndPrepare(name: string, keyHex: string): Promise<Db> {
  const raw = await SQLite.openDatabaseAsync(name);
  try {
    await raw.execAsync(keyPragma(keyHex));                 // 1. key first (SQLCipher requirement)
    await raw.execAsync("PRAGMA journal_mode = WAL;");
    const db = wrapExpoDb(raw);
    await db.first("SELECT count(*) AS n FROM sqlite_master"); // 2. fails here if the key is wrong or the file is not a database
    await migrate(db);
    remember(name);
    return db;
  } catch (e) { await raw.closeAsync().catch(() => {}); throw e; }
}

/** Opens (creating if needed) the user's database. If it cannot be read (wrong key, corruption) it is deleted and recreated once: it is a cache, never the source of truth. */
export async function openUserDb(userId: string): Promise<{ db: Db; recreated: boolean }> {
  const [name, key] = [await dbFileName(userId), await getOrCreateDbKey()];
  try { return { db: await openAndPrepare(name, key), recreated: false }; }
  catch (first) {
    console.warn("[db] could not open, recreating", first);
    await SQLite.deleteDatabaseAsync(name).catch(() => {});
    return { db: await openAndPrepare(name, key), recreated: true };
  }
}

export async function wipeUserDb(userId: string) {
  const name = await dbFileName(userId);
  await SQLite.deleteDatabaseAsync(name).catch(() => {});
  kv.setJson(NAMES, (kv.getJson<string[]>(NAMES) ?? []).filter((n) => n !== name));
}
/** Every database this app ever created on this device (used by "delete my data" and account deletion). */
export async function wipeAllDbs() {
  for (const n of kv.getJson<string[]>(NAMES) ?? []) await SQLite.deleteDatabaseAsync(n).catch(() => {});
  kv.remove(NAMES);
}
