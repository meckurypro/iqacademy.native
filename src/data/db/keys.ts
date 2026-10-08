// The database encryption key: 256 random bits, generated once per device, kept in the Keychain/Keystore.
// AFTER_FIRST_UNLOCK (not biometric-gated) on purpose: push and background handlers must be able to open the DB while the phone is locked-but-unlocked-once.
// The biometric app lock (M12) is a UI gate; it never changes how this key is read.
import * as SecureStore from "expo-secure-store";
import { getRandomBytes } from "expo-crypto";

const NAME = "iqa.db.key.v1";
const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } as const;
export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export async function getOrCreateDbKey(): Promise<string> {
  const have = await SecureStore.getItemAsync(NAME, opts);
  if (have && /^[0-9a-f]{64}$/.test(have)) return have;
  const key = toHex(getRandomBytes(32));
  await SecureStore.setItemAsync(NAME, key, opts);
  return key;
}
/** SQLCipher raw-key syntax. MUST be the first statement on a freshly opened connection. */
export const keyPragma = (hex: string) => `PRAGMA key = "x'${hex}'";`;
