// Device side of the upload queue: copy a picked file into the app's own storage (a picked file may live in a temp folder the system cleans up),
// queue it, and delete the copy when it is sent or discarded.
import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { UserMessage, friendly } from "@/core/errors";
import { getRuntime } from "./runtime";
import { extFor, type UploadJob, type UploadPayload } from "./uploads";

const dir = () => { const d = new Directory(Paths.document, "outbox"); d.create({ idempotent: true, intermediates: true }); return d; };
export const readBytes = (uri: string) => new File(uri).arrayBuffer();
export const removeLocal = async (uri: string) => { const f = new File(uri); if (f.exists) f.delete(); };

/** Queue an upload. Online it is sent straight away; offline it waits (and survives the app being closed). Resolves "queued" when it is still waiting. */
export async function queueUpload(job: UploadJob, srcUri: string, opts: { tags?: string[] } = {}): Promise<{ status: "done" } | { status: "queued"; id: string }> {
  const rt = getRuntime(); if (!rt?.outbox) throw new UserMessage("This can't be saved on this device right now.");
  const copy = new File(dir(), `${randomUUID()}.${extFor(job.mime)}`);
  new File(srcUri).copy(copy);
  const payload: UploadPayload = { ...job, localUri: copy.uri };
  const id = await rt.outbox.enqueue("upload", payload, { scope: `upload:${job.bucket}`, tags: opts.tags ?? [] });
  await rt.outbox.flush();
  const row = (await rt.outbox.list()).find((r) => r.id === id);
  if (!row) return { status: "done" };
  if (row.status === "dead") { await rt.outbox.discard(id); await removeLocal(copy.uri).catch(() => {}); throw new UserMessage(row.last_error ? friendly(new Error(row.last_error)) : "That could not be sent."); }
  return { status: "queued", id };
}
