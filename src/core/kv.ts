// Small plain-text key/value store for NON-SECRET prefs (theme, pending-verify email, resend cooldowns). Replaces web localStorage.
// Backed by expo-sqlite/kv-store (unencrypted by design: with SQLCipher enabled, a database opened without a key behaves as plain SQLite).
// Secrets go in SecureStore (src/core/secure.ts); user data goes in the per-user encrypted DB (src/data).
import Storage from "expo-sqlite/kv-store";

export const kv = {
  get: (k: string): string | null => { try { return Storage.getItemSync(k); } catch { return null; } },
  set: (k: string, v: string) => { try { Storage.setItemSync(k, v); } catch { /* storage unavailable */ } },
  remove: (k: string) => { try { Storage.removeItemSync(k); } catch { /* storage unavailable */ } },
  getJson: <T,>(k: string): T | null => { try { const v = Storage.getItemSync(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  setJson: (k: string, v: unknown) => { try { Storage.setItemSync(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
