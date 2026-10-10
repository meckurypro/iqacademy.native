// Receipt rules, pure part. The web shrinks photos to 1600 px at JPEG .82 before upload (phone photos are often 4-8 MB); PDFs go up as they are.
// PORT-OF web src/lib/offline.ts prepareReceipt @d14323f. The device part (picker, resizing) is receiptDevice.ts.
import { UserMessage } from "@/core/errors";
import { MAX_RECEIPT, RECEIPT_TYPES } from "@/data/uploads";

export const RECEIPT_MAX_SIDE = 1600;
export const RECEIPT_JPEG_QUALITY = 0.82;

export type ReceiptPlan = { action: "pdf" } | { action: "resize" };

/** What to do with a picked file, or a readable refusal. `mime` may be empty (some pickers do not know): then the file name's extension decides. */
export function planReceipt(mime: string | null | undefined, name: string | null | undefined, size: number | null | undefined): ReceiptPlan {
  const type = (mime || guessMime(name)).toLowerCase();
  if (type === "application/pdf") {
    if ((size ?? 0) > MAX_RECEIPT) throw new UserMessage("That PDF is over 5 MB. Upload a photo of the receipt instead.");
    return { action: "pdf" };
  }
  if (!type.startsWith("image/") && !(RECEIPT_TYPES as readonly string[]).includes(type)) throw new UserMessage("Upload a photo (JPG, PNG) or a PDF of your receipt.");
  return { action: "resize" };
}

export const guessMime = (name: string | null | undefined) => {
  const ext = (name ?? "").split(".").pop()?.toLowerCase();
  return ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" } as Record<string, string>)[ext ?? ""] ?? "";
};

/** Width/height to draw at so the longer side is at most `max` (never enlarges). */
export function fitWithin(w: number, h: number, max = RECEIPT_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** After resizing: still too big is refused; otherwise it is a JPEG of that size. */
export function checkResized(size: number) {
  if (size > MAX_RECEIPT) throw new UserMessage("That photo is too large. Try a smaller one.");
  if (size <= 0) throw new UserMessage("We couldn't read that file. Try another one.");
}

/** When the photo cannot be decoded (an unusual format), send it as it is only if it is one the server accepts and small enough. */
export function passThroughOk(mime: string | null | undefined, size: number) {
  return !!mime && (RECEIPT_TYPES as readonly string[]).includes(mime) && size > 0 && size <= MAX_RECEIPT;
}
export const UNREADABLE = "We couldn't read that photo. Try a screenshot or a PDF instead.";
