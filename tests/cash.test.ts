import { CASH_TAGS, DECLINE_REASONS, HANDOVER_REPLY, amountReady, flipPick, handoverReply, pickedTotal, remitPath, toKobo } from "@/features/cash/cash";
import { noteLink } from "@/features/notifications/format";

describe("cash amounts", () => {
  it("turns naira text into kobo without float drift", () => {
    expect(toKobo("3,000,000")).toBe(300000000);
    expect(toKobo("₦25,000.50")).toBe(2500050);
    expect(toKobo("19.99")).toBe(1999);
    expect(toKobo("0.1")).toBe(10);
  });
  it("refuses anything that is not a positive amount with at most two decimals", () => {
    for (const bad of ["", "abc", "12.345", "-5", "1e5", "1..2", "  "]) expect(toKobo(bad)).toBe(0);
  });
  it("only lets the cash button through when the typed amount is exactly what is due", () => {
    expect(amountReady("30,000", 3000000)).toBe(true);
    expect(amountReady("29,999.99", 3000000)).toBe(false);
    expect(amountReady("30,000.01", 3000000)).toBe(false);
    expect(amountReady("", 3000000)).toBe(false);
    expect(amountReady("0", 0)).toBe(false);
  });
});

describe("picking cash to send", () => {
  const items = [{ id: "a", amount: 300 }, { id: "b", amount: 250 }, { id: "c", amount: 500 }];
  it("totals only the ticked items", () => {
    expect(pickedTotal(items, new Set(["a", "c"]))).toBe(800);
    expect(pickedTotal(items, new Set())).toBe(0);
    expect(pickedTotal(items, new Set(["zzz"]))).toBe(0);
  });
  it("flips one tick without touching the original set", () => {
    const s = new Set(["a"]);
    const on = flipPick(s, "b"); const off = flipPick(on, "a");
    expect([...s]).toEqual(["a"]); expect([...on].sort()).toEqual(["a", "b"]); expect([...off]).toEqual(["b"]);
  });
});

describe("remittance receipts and replies", () => {
  it("builds the storage path the database insists on: <uid>/<remittance id>/<file>", () => {
    expect(remitPath("u1", "r1", "jpg", 1700000000000)).toBe("u1/r1/1700000000000.jpg");
  });
  it("explains every PIN outcome the server can return, and falls back for anything else", () => {
    for (const k of ["pin_incorrect", "pin_locked", "pin_not_set", "handover_voided"]) expect(handoverReply(k)).toBe(HANDOVER_REPLY[k]);
    expect(handoverReply("surprise")).toMatch(/try again/i);
    expect(handoverReply(null)).toMatch(/try again/i);
    expect(handoverReply("handover_voided")).toMatch(/cancelled/);
  });
  it("refreshes everything a cash action changes", () => { expect(CASH_TAGS).toEqual(expect.arrayContaining(["cash", "payments", "enrolments", "students"])); });
  it("offers three ready reasons for declining a transfer", () => { expect(DECLINE_REASONS).toHaveLength(3); });
});

describe("notifications", () => {
  it("opens the Cash screen from any cash notification", () => {
    for (const t of ["cash_collected", "cash_remittance_review", "cash_handover_started", "cash_handover_received", "cash_admin_transfer_review", "cash_remittance_declined"]) expect(noteLink(t)).toEqual({ to: "/cash", label: "Open cash" });
    expect(noteLink("payment_received")).toBeNull();
  });
});
