// Upload queue, pure part: path/validation rules and the outbox handler. File access is injected, so this is tested without a phone.
// A queued upload is: (1) put the file in storage, (2) record it (an RPC, or the avatar address on the profile). Both steps are safe to repeat,
// so a retry after a dropped connection never duplicates anything: "already exists" on step 1 means an earlier try got through.
import { ok, UserMessage } from "@/core/errors";

export const MAX_RECEIPT = 5 * 1024 * 1024; // the database rejects anything larger
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_AVATAR = 5 * 1024 * 1024;

export type After = { kind: "rpc"; name: string; args: Record<string, unknown> } | { kind: "avatar"; userId: string };
export type UploadPayload = { bucket: string; path: string; localUri: string; mime: string; size: number; upsert: boolean; after?: After };
export type UploadJob = Omit<UploadPayload, "localUri"> & { /** Order key in the outbox. Defaults to one line per bucket; chat uses one line per class so text and files keep their order. */ scope?: string };

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // class chat: any file up to 25 MB (the database refuses more)
/** File names become part of a storage path: plain characters only, at most 80 from the end (keeps the extension). */
export const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file";
export const chatMediaPath = (sessionId: string, id: string, name: string) => `${sessionId}/${id}-${safeName(name)}`;
const MIME_OK = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/;

export const extFor = (mime: string) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" })[mime] ?? "bin";

/** Same rules the database enforces in submit_offline_receipt, so a bad file is refused at once instead of failing in the queue. */
export function receiptJob(o: { studentId: string; paymentId: string; mime: string; size: number; name?: string; note?: string; now: number }): UploadJob {
  if (!(RECEIPT_TYPES as readonly string[]).includes(o.mime)) throw new UserMessage("Upload a photo (JPG, PNG) or a PDF of your receipt.");
  if (o.size <= 0) throw new UserMessage("We couldn't read that file. Try another one.");
  if (o.size > MAX_RECEIPT) throw new UserMessage(o.mime === "application/pdf" ? "That PDF is over 5 MB. Upload a photo of the receipt instead." : "That photo is too large. Try a smaller one.");
  const ext = extFor(o.mime);
  const path = `${o.studentId}/${o.paymentId}/${o.now}.${ext}`;
  return {
    bucket: "payment-receipts", path, mime: o.mime, size: o.size, upsert: false,
    after: { kind: "rpc", name: "submit_offline_receipt", args: { p_payment_id: o.paymentId, p_path: path, p_name: o.name || `receipt.${ext}`, p_mime: o.mime, p_size: o.size, p_note: o.note?.trim() || null } },
  };
}
export function avatarJob(o: { userId: string; mime: string; size: number; now: number }): UploadJob {
  if (!(AVATAR_TYPES as readonly string[]).includes(o.mime)) throw new UserMessage("Choose a JPG, PNG or WebP photo.");
  if (o.size <= 0 || o.size > MAX_AVATAR) throw new UserMessage("That photo is too large. Try a smaller one.");
  return { bucket: "avatars", path: `${o.userId}/avatar-${o.now}.${extFor(o.mime)}`, mime: o.mime, size: o.size, upsert: true, after: { kind: "avatar", userId: o.userId } };
}

type DbErr = { message: string; code?: string } | null;
type StorageErr = { message?: string; status?: number | string; statusCode?: number | string } | null;
export type UploadSb = {
  storage: { from: (b: string) => { upload: (p: string, body: ArrayBuffer, o: { contentType: string; upsert: boolean }) => Promise<{ error: StorageErr }>; getPublicUrl: (p: string) => { data: { publicUrl: string } } } };
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: DbErr }>;
  from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: DbErr }> } };
};
const alreadyThere = (e: NonNullable<StorageErr>) => String(e.status ?? e.statusCode) === "409" || /already exists|duplicate/i.test(e.message ?? "");

export function createUploadHandler(d: { sb: UploadSb; readBytes: (uri: string) => Promise<ArrayBuffer>; removeLocal: (uri: string) => Promise<void> }) {
  return async (p: UploadPayload) => {
    const bytes = await d.readBytes(p.localUri); // a missing file throws a plain error: not a network error, so the row is given up on
    const { error } = await d.sb.storage.from(p.bucket).upload(p.path, bytes, { contentType: p.mime, upsert: p.upsert });
    if (error && !alreadyThere(error)) throw Object.assign(new Error(error.message ?? "upload failed"), { status: Number(error.status ?? error.statusCode ?? 0) || undefined });
    if (p.after?.kind === "rpc") ok(await d.sb.rpc(p.after.name, p.after.args));
    else if (p.after?.kind === "avatar") ok({ data: null, ...(await d.sb.from("profiles").update({ avatar_url: d.sb.storage.from(p.bucket).getPublicUrl(p.path).data.publicUrl }).eq("id", p.after.userId)) });
    await d.removeLocal(p.localUri).catch(() => {});
  };
}

/**
 * An attachment for a class chat: upload to the class's folder, then post the message. `id` is the message's client id, chosen once, so every retry posts the same
 * message (the server returns the existing one) and the stored file has a fixed path.
 */
export function chatMediaJob(o: { sessionId: string; body: string | null; name: string; mime: string; size: number; id: string }): UploadJob {
  const mime = o.mime && MIME_OK.test(o.mime) && o.mime.length <= 127 ? o.mime : "application/octet-stream";
  if (o.size <= 0 || o.size > MAX_MEDIA_BYTES) throw new UserMessage("That file can't be sent. Choose a file under 25 MB.");
  const path = chatMediaPath(o.sessionId, o.id, o.name);
  return {
    bucket: "class-messages", path, mime, size: o.size, upsert: false, scope: `chat:${o.sessionId}`,
    after: { kind: "rpc", name: "send_class_message", args: { p_session_id: o.sessionId, p_body: o.body?.trim() || null, p_media_path: path, p_media_name: o.name.slice(0, 200), p_media_mime: mime, p_media_size: o.size, p_client_id: o.id } },
  };
}
