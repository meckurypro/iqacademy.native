import { STATUS, namesMatch, statusInfo, withdrawState } from "../src/features/wallet/walletUi";

describe("wallet display rules", () => {
  it("covers every withdrawal status the database allows", () => {
    for (const s of ["draft", "processing", "paid", "failed", "rejected", "cancelled"]) expect(STATUS[s]).toBeDefined();
    expect(statusInfo("something_new").tone).toBe("muted");
  });
  it("picks the right withdraw state, in priority order", () => {
    expect(withdrawState({ account: null, available: 500, min_payout: 0 })).toBe("no_account");
    expect(withdrawState({ account: {}, available: 0, min_payout: 0 })).toBe("nothing");
    expect(withdrawState({ account: {}, available: -100, min_payout: 0 })).toBe("nothing");
    expect(withdrawState({ account: {}, available: 500, min_payout: 1000 })).toBe("below_min");
    expect(withdrawState({ account: {}, available: 1000, min_payout: 1000 })).toBe("ready");
  });
  it("matches account names on whole words, any order, ignoring case", () => {
    expect(namesMatch("CHUKWU CHIDERA EMMANUEL", "Chukwu Chidera Emmanuel")).toBe(true);
    expect(namesMatch("EMMANUEL CHUKWU CHIDERA", "Chidera Chukwu")).toBe(true);
    expect(namesMatch("JOHN SMITH", "Chidera Chukwu")).toBe(false);
    expect(namesMatch("CHIDERA OKAFOR", "Chidera Chukwu")).toBe(false); // one shared word out of two is not enough
    expect(namesMatch("ANYONE", "")).toBe(false);
  });
});
