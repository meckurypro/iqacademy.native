// SecureStore adapter for Supabase's auth session. A session (access + refresh token + user) can be a few KB; to stay well clear of any
// per-item size limit the value is split into small chunks. (Defensive: the SDK 57 typings state no limit, so this is a precaution, not a measured need.)
import * as SecureStore from "expo-secure-store";

const CHUNK = 1500;
const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } as const; // readable by push/background handlers after the first unlock
const countKey = (k: string) => `${k}.n`;
const chunkKey = (k: string, i: number) => `${k}.${i}`;
// SecureStore keys may only contain [A-Za-z0-9._-]
export const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");

export const chunkedSecureStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safeKey(rawKey);
    const n = Number(await SecureStore.getItemAsync(countKey(key), opts));
    if (!Number.isFinite(n) || n <= 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(chunkKey(key, i), opts);
      if (p == null) return null; // torn write: treat as signed out rather than hand back a corrupt session
      parts.push(p);
    }
    return parts.join("");
  },
  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safeKey(rawKey);
    const prev = Number(await SecureStore.getItemAsync(countKey(key), opts)) || 0;
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
    await SecureStore.setItemAsync(countKey(key), String(n), opts); // count last: a half-written value is never read
    for (let i = n; i < prev; i++) await SecureStore.deleteItemAsync(chunkKey(key, i), opts);
  },
  async removeItem(rawKey: string): Promise<void> {
    const key = safeKey(rawKey);
    const n = Number(await SecureStore.getItemAsync(countKey(key), opts)) || 0;
    await SecureStore.deleteItemAsync(countKey(key), opts);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(chunkKey(key, i), opts);
  },
};
