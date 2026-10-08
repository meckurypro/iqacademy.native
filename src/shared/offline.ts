// PORT-OF web src/lib/offline.ts @0081e66 — types and limits. `prepareReceipt` (canvas) is replaced by expo-image-manipulator in M7b.
export type Receipt = { path: string; name: string; mime: string; size: number; uploaded_at: string };
export type OfflineDetails = { bank_name?: string; account_name?: string; account_number?: string; instructions?: string };
export type MyOffline = {
  id: string; reference: string; amount: number; created_at: string; enrolment_id: string; instalment_id: string | null;
  instalment_number: number | null; instalment_label: string | null; enrolment_status: string; package: string; courses: string[];
  receipt: Receipt | null; student_note: string | null;
};
export const MAX_RECEIPT = 5 * 1024 * 1024;
export const OK_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
