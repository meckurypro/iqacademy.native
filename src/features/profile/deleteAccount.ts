// Account deletion (Apple requires it in-app). The server deactivates and anonymises; payment and attendance records stay, as they must.
import { friendly, UserMessage } from "@/core/errors";
import { invokeFunction, signOutAndWipe } from "@/data";

export const DELETE_WARNING = "This permanently closes your account and removes your name, email, phone, photo and personal details. Payment and attendance records are kept for the academy's accounts but no longer show who you are. This cannot be undone.";
/** Wording for what the server can say. Admins cannot delete themselves (the last admin must never disappear by accident). */
export function deleteErrorMessage(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e);
  if (m.includes("admin_cannot_delete")) return "Admin accounts can't be deleted from the app. Ask another admin to change your role first.";
  if (m.includes("delete_incomplete")) return "Your details were removed but we couldn't finish closing the sign-in. Please try again.";
  if (m.includes("delete_failed")) return "We couldn't delete your account just now. Please try again.";
  return friendly(e);
}
export async function deleteMyAccount(): Promise<void> {
  try { await invokeFunction("delete-account", { confirm: "DELETE" }); } catch (e) { throw new UserMessage(deleteErrorMessage(e)); }
  await signOutAndWipe(async () => true); // the account is gone: nothing left to protect from unsent changes
}
