// Receipt capture, device part: choose a photo (library or camera) or a PDF, shrink photos, hand back a local file ready for the upload queue.
// APIs checked against the installed SDK 57 typings: expo-image-picker (launchImageLibraryAsync / launchCameraAsync / requestCameraPermissionsAsync),
// expo-document-picker (getDocumentAsync), expo-image-manipulator (ImageManipulator.manipulate(...).resize().renderAsync() → saveAsync; manipulateAsync is deprecated).
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { UserMessage } from "@/core/errors";
import { RECEIPT_JPEG_QUALITY, UNREADABLE, checkResized, fitWithin, guessMime, passThroughOk, planReceipt } from "./receipt";

export type PickedReceipt = { uri: string; name: string; mime: string; size: number };
export const CAMERA_DENIED = "Camera access is off. Allow it for IQ Academy in your phone's Settings, or choose a photo from your library.";

type Raw = { uri: string; name: string; mime?: string | null; size?: number | null; width?: number; height?: number };

async function prepare(r: Raw): Promise<PickedReceipt> {
  const plan = planReceipt(r.mime, r.name, r.size);
  const size = r.size ?? (() => { try { return new File(r.uri).size ?? 0; } catch { return 0; } })();
  if (plan.action === "pdf") return { uri: r.uri, name: r.name || "receipt.pdf", mime: "application/pdf", size };
  try {
    let w = r.width ?? 0, h = r.height ?? 0;
    if (!w || !h) { const probe = await ImageManipulator.ImageManipulator.manipulate(r.uri).renderAsync(); w = probe.width; h = probe.height; } // the picker did not say how big it is
    const { width } = fitWithin(w, h);
    const ref = await ImageManipulator.ImageManipulator.manipulate(r.uri).resize({ width }).renderAsync();
    const out = await ref.saveAsync({ compress: RECEIPT_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG });
    const outSize = new File(out.uri).size ?? 0;
    checkResized(outSize);
    return { uri: out.uri, name: (r.name || "receipt").replace(/\.[^.]+$/, "") + ".jpg", mime: "image/jpeg", size: outSize };
  } catch (e) {
    if (e instanceof UserMessage) throw e;
    const mime = r.mime || guessMime(r.name);
    if (passThroughOk(mime, size)) return { uri: r.uri, name: r.name || "receipt", mime, size };
    throw new UserMessage(UNREADABLE);
  }
}

const fromAsset = (a: ImagePicker.ImagePickerAsset): Raw => ({ uri: a.uri, name: a.fileName ?? "receipt.jpg", mime: a.mimeType, size: a.fileSize, width: a.width, height: a.height });

/** A photo from the library. Resolves null when the person backs out. */
export async function pickReceiptPhoto(): Promise<PickedReceipt | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: false });
  return r.canceled || !r.assets[0] ? null : prepare(fromAsset(r.assets[0]));
}

/** A new photo from the camera. Asks for permission only now, in context; a refusal says how to fix it. */
export async function takeReceiptPhoto(): Promise<PickedReceipt | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new UserMessage(CAMERA_DENIED);
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  return r.canceled || !r.assets[0] ? null : prepare(fromAsset(r.assets[0]));
}

/** A PDF (or an image file) from the phone's files. */
export async function pickReceiptFile(): Promise<PickedReceipt | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  return prepare({ uri: a.uri, name: a.name, mime: a.mimeType, size: a.size });
}
