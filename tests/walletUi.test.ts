import { STATUS, monthHint, namesMatch, statusInfo } from "../src/features/wallet/walletUi";

describe("wallet display rules", () => {
  it("covers every withdrawal status the database allows", () => {
    for (const s of ["draft", "processing", "paid", "failed", "rejected", "cancelled"]) expect(STATUS[s]).toBeDefined();
    expect(statusInfo("something_new").tone).toBe("muted");
  });
  it("tells the instructor why a month cannot be withdrawn yet, in priority order", () => {
    const ok = { account: { ready: true }, min_payout: 0 };
    expect(monthHint({ available: 0, can_withdraw: false }, ok)).toBe("nothing");
    expect(monthHint({ available: -500, can_withdraw: false }, ok)).toBe("nothing");
    expect(monthHint({ available: 500, can_withdraw: false }, { account: { ready: false }, min_payout: 0 })).toBe("no_account");
    expect(monthHint({ available: 500, can_withdraw: false }, { account: null, min_payout: 0 })).toBe("no_account");
    expect(monthHint({ available: 500, can_withdraw: false }, { account: { ready: true }, min_payout: 1000 })).toBe("below_min");
    expect(monthHint({ available: 500, can_withdraw: false }, ok)).toBe("not_open");
    expect(monthHint({ available: 500, can_withdraw: true }, ok)).toBe("can_withdraw");
  });
  it("matches account names on whole words, any order, ignoring case", () => {
    expect(namesMatch("CHUKWU CHIDERA EMMANUEL", "Chukwu Chidera Emmanuel")).toBe(true);
    expect(namesMatch("EMMANUEL CHUKWU CHIDERA", "Chidera Chukwu")).toBe(true);
    expect(namesMatch("JOHN SMITH", "Chidera Chukwu")).toBe(false);
    expect(namesMatch("CHIDERA OKAFOR", "Chidera Chukwu")).toBe(false);
    expect(namesMatch("ANYONE", "")).toBe(false);
  });
});
