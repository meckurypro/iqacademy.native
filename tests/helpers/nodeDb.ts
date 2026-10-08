// A Db backed by Node's built-in SQLite, so migrations, SQL and queue ordering are tested for real without a device.
import type { Bind, Db } from "@/data/db/types";

type NodeSqlite = { DatabaseSync: new (path: string) => { exec(s: string): void; prepare(s: string): { run(...p: unknown[]): { changes: number | bigint }; all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown }; close(): void } };
const sqlite = (process as unknown as { getBuiltinModule: (n: string) => NodeSqlite }).getBuiltinModule("node:sqlite");

export function nodeDb(): Db {
  const raw = new sqlite.DatabaseSync(":memory:");
  const bind = (p: Bind[] = []) => p.map((x) => (typeof x === "boolean" ? Number(x) : x));
  const self: Db = {
    exec: async (sql) => { raw.exec(sql); },
    run: async (sql, p) => ({ changes: Number(raw.prepare(sql).run(...bind(p)).changes) }),
    all: async <T,>(sql: string, p?: Bind[]) => raw.prepare(sql).all(...bind(p)) as T[],
    first: async <T,>(sql: string, p?: Bind[]) => ((raw.prepare(sql).get(...bind(p)) as T | undefined) ?? null),
    transaction: async <T,>(fn: (t: Db) => Promise<T>) => {
      raw.exec("BEGIN");
      try { const r = await fn(self); raw.exec("COMMIT"); return r; } catch (e) { raw.exec("ROLLBACK"); throw e; }
    },
    close: async () => raw.close(),
  };
  return self;
}
