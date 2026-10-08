// Native modules are replaced with node equivalents so pure logic and the data layer can be tested without a device.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("expo-crypto", () => {
  const c = require("crypto");
  return {
    getRandomValues: (a: Uint8Array) => c.webcrypto.getRandomValues(a),
    getRandomBytes: (n: number) => new Uint8Array(c.randomBytes(n)),
    digestStringAsync: async (_alg: string, s: string) => c.createHash("sha256").update(s).digest("hex"),
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  };
});

jest.mock("expo-sqlite/kv-store", () => {
  const mem = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (k: string) => mem.get(k) ?? null,
      setItemSync: (k: string, v: string) => void mem.set(k, v),
      removeItemSync: (k: string) => mem.delete(k),
      getAllKeysSync: () => [...mem.keys()],
    },
  };
});

jest.mock("expo-secure-store", () => {
  const secure = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
    getItemAsync: async (k: string) => secure.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void secure.set(k, v),
    deleteItemAsync: async (k: string) => void secure.delete(k),
  };
});
