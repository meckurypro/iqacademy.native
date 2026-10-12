// Device part of sending a bank receipt for cash that is being remitted. Unlike a student's receipt this is NOT queued: it moves money,
// so it is online-only. The file goes to payment-receipts/<uid>/<remittance id>/<file>; the same remittance id is then sent to the database,
// which makes a retry after a lost reply harmless. If the database refuses, the uploaded file is removed again.
import { randomUUID } from "expo-crypto";
import { online } from "@/data";
import { readBytes } from "@/data/stage";
import { extFor } from "@/data/uploads";
import type { PickedReceipt } from "@/features/enrol/receiptDevice";
import { remitPath } from "./cash";

export const newRemittanceId = () => randomUUID();
const BUCKET = "payment-receipts";

export type Uploaded = { path: string; name: string; mime: string; size: number };

export async function uploadRemitReceipt(uid: string, remittanceId: string, file: PickedReceipt): Promise<Uploaded> {
  const path = remitPath(uid, remittanceId, extFor(file.mime), Date.now());
  const bytes = await readBytes(file.uri);
  await online(async (sb) => { const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: file.mime, upsert: false }); if (error) throw error; });
  return { path, name: file.name, mime: file.mime, size: file.size };
}

export const removeReceipt = (path: string | null | undefined) => (path ? online(async (sb) => { await sb.storage.from(BUCKET).remove([path]); }).catch(() => undefined) : Promise.resolve());

export const signedReceiptUrl = (path: string) => online(async (sb) => { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 300); if (error) throw error; return data.signedUrl; });
