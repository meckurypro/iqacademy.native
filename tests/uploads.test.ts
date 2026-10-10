import { avatarJob, createUploadHandler, extFor, receiptJob, type UploadPayload, type UploadSb } from "@/data/uploads";
import { labelForRow } from "@/data/policies";

const NOW = 1_700_000_000_000;
describe("upload rules", () => {
  it("receipt path matches what the database requires: <student>/<payment>/...", () => {
    const j = receiptJob({ studentId: "s1", paymentId: "p1", mime: "image/jpeg", size: 1000, note: "  paid at bank ", now: NOW });
    expect(j.path).toBe(`s1/p1/${NOW}.jpg`); expect(j.bucket).toBe("payment-receipts"); expect(j.upsert).toBe(false);
    expect(j.after).toEqual({ kind: "rpc", name: "submit_offline_receipt", args: { p_payment_id: "p1", p_path: j.path, p_name: "receipt.jpg", p_mime: "image/jpeg", p_size: 1000, p_note: "paid at bank" } });
  });
  it("refuses files the server would refuse, with the web wording", () => {
    const base = { studentId: "s", paymentId: "p", now: NOW };
    expect(() => receiptJob({ ...base, mime: "image/gif", size: 10 })).toThrow("Upload a photo (JPG, PNG) or a PDF");
    expect(() => receiptJob({ ...base, mime: "application/pdf", size: 6 * 1024 * 1024 })).toThrow("over 5 MB");
    expect(() => receiptJob({ ...base, mime: "image/png", size: 6 * 1024 * 1024 })).toThrow("too large");
    expect(() => receiptJob({ ...base, mime: "image/png", size: 0 })).toThrow("couldn't read");
    expect(() => receiptJob({ ...base, mime: "image/png", size: 5 * 1024 * 1024 })).not.toThrow();
  });
  it("avatars upsert under the user's folder; pdf is not an avatar", () => {
    const j = avatarJob({ userId: "u1", mime: "image/webp", size: 10, now: NOW });
    expect(j.path).toBe(`u1/avatar-${NOW}.webp`); expect(j.upsert).toBe(true);
    expect(() => avatarJob({ userId: "u1", mime: "application/pdf", size: 10, now: NOW })).toThrow();
    expect(extFor("text/plain")).toBe("bin");
  });
  it("labels rows for the Pending screen", () => {
    expect(labelForRow({ kind: "upload", payload: { bucket: "payment-receipts" } })).toBe("Upload payment receipt");
    expect(labelForRow({ kind: "upload", payload: { bucket: "avatars" } })).toBe("Upload profile photo");
    expect(labelForRow({ kind: "rpc", payload: { name: "send_class_message" } })).toBe("Send class message");
  });
});

describe("upload handler", () => {
  const payload = (after?: UploadPayload["after"]): UploadPayload => ({ bucket: "payment-receipts", path: "s/p/1.jpg", localUri: "file:///x.jpg", mime: "image/jpeg", size: 5, upsert: false, after });
  const make = (o: { uploadError?: object | null; rpcError?: { message: string } | null; readFails?: boolean } = {}) => {
    const calls: string[] = []; const profile = jest.fn(async () => ({ error: null }));
    const sb: UploadSb = {
      storage: { from: () => ({ upload: async () => { calls.push("upload"); return { error: o.uploadError ?? null } as never; }, getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn/${p}` } }) }) },
      rpc: async (name) => { calls.push(`rpc:${name}`); return { data: null, error: o.rpcError ?? null }; },
      from: () => ({ update: (v) => ({ eq: async (c, id) => { calls.push(`profile:${c}=${id}:${String(v.avatar_url)}`); return profile(); } }) }),
    };
    const removed: string[] = [];
    const h = createUploadHandler({ sb, readBytes: async () => { if (o.readFails) throw new Error("missing"); return new ArrayBuffer(1); }, removeLocal: async (u) => { removed.push(u); } });
    return { h, calls, removed };
  };
  it("uploads, records the receipt, then deletes the local copy", async () => {
    const t = make(); await t.h(payload({ kind: "rpc", name: "submit_offline_receipt", args: {} }));
    expect(t.calls).toEqual(["upload", "rpc:submit_offline_receipt"]); expect(t.removed).toEqual(["file:///x.jpg"]);
  });
  it("a repeat after the file already landed (409) carries on to the record step", async () => {
    const t = make({ uploadError: { message: "The resource already exists", status: 409 } }); await t.h(payload({ kind: "rpc", name: "r", args: {} }));
    expect(t.calls).toEqual(["upload", "rpc:r"]); expect(t.removed).toHaveLength(1);
  });
  it("a failed upload throws with its status and keeps the local copy for the retry", async () => {
    const t = make({ uploadError: { message: "boom", status: 503 } });
    await expect(t.h(payload())).rejects.toMatchObject({ status: 503 }); expect(t.removed).toEqual([]);
  });
  it("a refused record step throws and keeps the file", async () => {
    const t = make({ rpcError: { message: "payment_not_open" } });
    await expect(t.h(payload({ kind: "rpc", name: "r", args: {} }))).rejects.toBeTruthy(); expect(t.removed).toEqual([]);
  });
  it("avatar: sets the profile address to the public url", async () => {
    const t = make(); await t.h({ ...payload({ kind: "avatar", userId: "u1" }), bucket: "avatars", path: "u1/a.jpg" });
    expect(t.calls).toEqual(["upload", "profile:id=u1:https://cdn/u1/a.jpg"]);
  });
  it("a missing local file fails without touching storage", async () => {
    const t = make({ readFails: true }); await expect(t.h(payload())).rejects.toThrow("missing"); expect(t.calls).toEqual([]);
  });
});
