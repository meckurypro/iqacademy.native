// Local schema, versioned with PRAGMA user_version. Append only: never edit a shipped migration, add the next version.
// The DB is a CACHE plus an OUTBOX: cache rows can always be dropped and re-fetched; outbox rows are unsent user actions.
import type { Db } from "./types";

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE cache_entries (
        key TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '',
        fetched_at INTEGER NOT NULL, ttl_ms INTEGER NOT NULL, stale INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, payload TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'default', tags TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, next_attempt_at INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
      );
      CREATE INDEX outbox_scope ON outbox(scope, seq);
      CREATE TABLE blob_index (path TEXT PRIMARY KEY NOT NULL, local_uri TEXT NOT NULL, size INTEGER, fetched_at INTEGER NOT NULL);
    `,
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function migrate(db: Db): Promise<number> {
  const cur = (await db.first<{ user_version: number }>("PRAGMA user_version"))?.user_version ?? 0;
  if (cur > SCHEMA_VERSION) throw new Error(`local database is newer (v${cur}) than this app (v${SCHEMA_VERSION})`);
  for (const m of MIGRATIONS.filter((x) => x.version > cur)) {
    await db.transaction(async (tx) => { await tx.exec(m.sql); await tx.exec(`PRAGMA user_version = ${m.version}`); });
  }
  return SCHEMA_VERSION;
}
