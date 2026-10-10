// Device side of class chat: pick a photo or file, open / download / copy / share a message, and the network steps used when an instructor sends messages on to other chats.
// The rules (limits, paths, ordering, retries) live in format.ts / sendToChats.ts and are tested; this file only talks to the phone.
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Share } from "react-native";
import { online, safeName } from "@/data";
import { ok } from "@/core/errors";
import { BUCKET, mimeFor, type ClassMessage } from "./format";
import type { Media, SendDeps } from "./sendToChats";

export type Picked = { uri: string; name: string; mime: string; size: number };
const sizeOf = (uri: string, given?: number | null) => given ?? new File(uri).size ?? 0;

/** A photo or video from the library. null when the person backs out. */
export async function pickPhoto(): Promise<Picked | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: false, quality: 0.85 });
  const a = r.canceled ? null : r.assets[0]; if (!a) return null;
  const name = a.fileName || `photo-${Date.now()}.${a.type === "video" ? "mp4" : "jpg"}`;
  return { uri: a.uri, name, mime: mimeFor(name, a.mimeType), size: sizeOf(a.uri, a.fileSize) };
}
/** Any file (the chat accepts any kind, up to 25 MB). The picker copies it into the app's cache so it stays readable. */
export async function pickFile(): Promise<Picked | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  const a = r.canceled ? null : r.assets[0]; if (!a) return null;
  return { uri: a.uri, name: a.name, mime: mimeFor(a.name, a.mimeType), size: sizeOf(a.uri, a.size) };
}

const signedUrl = (m: ClassMessage, asDownload: boolean) => online(async (sb) => {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(m.media_path!, 120, asDownload ? { download: m.media_name ?? true } : undefined);
  if (error || !data?.signedUrl) throw error ?? new Error("download_failed");
  return data.signedUrl;
});
/** Download or view the file in the in-app browser (the device decides what to do with it). */
export async function openMedia(m: ClassMessage) { await WebBrowser.openBrowserAsync(await signedUrl(m, true)); }

const removeFile = (f: File) => { try { if (f.exists) f.delete(); } catch { /* cache file: the system cleans it up anyway */ } };
async function downloadToCache(m: ClassMessage): Promise<File> {
  const dest = new File(Paths.cache, `${randomUUID()}-${safeName(m.media_name ?? "file")}`);
  return File.downloadFileAsync(await signedUrl(m, false), dest, { idempotent: true });
}

export const copyText = async (text: string) => { await Clipboard.setStringAsync(text); };

/** Share a message with another app: a file goes through the system share sheet; text goes as text. */
export async function shareMessage(m: ClassMessage): Promise<"shared" | "copied" | "cancelled"> {
  const title = m.course_title ? `${m.course_title} · IQ Academy` : "IQ Academy";
  if (m.media_path) {
    if (!(await Sharing.isAvailableAsync())) { await openMedia(m); return "shared"; }
    const f = await downloadToCache(m);
    try { await Sharing.shareAsync(f.uri, { mimeType: m.media_mime ?? undefined, dialogTitle: title }); return "shared"; } finally { removeFile(f); }
  }
  const r = await Share.share({ message: m.body ?? "", title });
  return r.action === Share.dismissedAction ? "cancelled" : "shared";
}

/** Network steps for sendToChats. Strictly online (nothing is queued): the instructor sees at once which chats got the messages. */
export const sendToChatsDeps = (): SendDeps => ({
  newId: () => randomUUID(),
  fetchMedia: async (m): Promise<Media> => {
    const f = await downloadToCache(m);
    try { const bytes = await f.arrayBuffer(); return { bytes, mime: m.media_mime ?? "application/octet-stream", size: m.media_size ?? bytes.byteLength }; } finally { removeFile(f); }
  },
  upload: (path, media) => online(async (sb) => {
    const { error } = await sb.storage.from(BUCKET).upload(path, media.bytes, { contentType: media.mime, upsert: false });
    const e = error as { message?: string; status?: number | string; statusCode?: number | string } | null;
    if (e && String(e.status ?? e.statusCode) !== "409" && !/already exists|duplicate/i.test(e.message ?? "")) throw error; // an earlier try already stored it: carry on
  }),
  send: async (args) => { await online(async (sb) => { ok(await sb.rpc("send_class_message", args)); }); },
});
