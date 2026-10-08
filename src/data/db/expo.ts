import type { SQLiteDatabase } from "expo-sqlite";
import type { Bind, Db } from "./types";

type Runner = Pick<SQLiteDatabase, "execAsync" | "runAsync" | "getAllAsync" | "getFirstAsync">;
const wrap = (d: Runner, tx: boolean, root: SQLiteDatabase): Db => ({
  exec: (sql) => d.execAsync(sql),
  run: async (sql, params = []) => { const r = await d.runAsync(sql, params as never); return { changes: r.changes }; },
  all: <T,>(sql: string, params: Bind[] = []) => d.getAllAsync<T>(sql, params as never),
  first: async <T,>(sql: string, params: Bind[] = []) => (await d.getFirstAsync<T>(sql, params as never)) ?? null,
  transaction: async <T,>(fn: (t: Db) => Promise<T>) => {
    if (tx) return fn(wrap(d, true, root)); // already inside one
    let out!: T;
    await root.withExclusiveTransactionAsync(async (t) => { out = await fn(wrap(t as unknown as Runner, true, root)); });
    return out;
  },
  close: () => root.closeAsync(),
});
export const wrapExpoDb = (raw: SQLiteDatabase): Db => wrap(raw, false, raw);
