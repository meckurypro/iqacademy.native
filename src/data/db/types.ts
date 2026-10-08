// The only database surface the data layer knows. Production = expo-sqlite (SQLCipher); tests = node:sqlite. Keeps SQL testable without a device.
export type Bind = string | number | null | boolean | Uint8Array;
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: Bind[]): Promise<{ changes: number }>;
  all<T = Record<string, unknown>>(sql: string, params?: Bind[]): Promise<T[]>;
  first<T = Record<string, unknown>>(sql: string, params?: Bind[]): Promise<T | null>;
  /** All-or-nothing. Nested calls join the outer transaction. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
