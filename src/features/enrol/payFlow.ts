// Paying in the app, device part. Used by single courses now and by Enrol / instalments later (M7b).
import { AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { invokeFunction, online } from "@/data";
import { pollPayment, waitForForeground, type PayStatus } from "./pay";

const PAID_TAGS = ["enrolments", "payments", "sessions", "notifications"];

/** Ask the server whether the money for this reference arrived (up to 6 asks, 2.5 s apart: the bank can take a moment). Refreshes what a payment changes once it has. */
export async function verifyPayment(reference: string): Promise<PayStatus> {
  const status = await pollPayment((ref) => online(async (sb) => (await sb.functions.invoke("paystack-verify-payment", { body: { reference: ref } })).data?.status as string | undefined), reference);
  if (status === "succeeded") await online(async () => undefined, { invalidates: PAID_TAGS });
  return status;
}

/** Start a Paystack payment for one instalment, show it, and report whether the money arrived. Throws a readable error if the payment could not even be started. */
export async function payInstalment(instalmentId: string): Promise<PayStatus> {
  const init = await invokeFunction<{ authorization_url?: string; reference: string }>("paystack-init-payment", { instalment_id: instalmentId });
  if (!init.authorization_url) throw new Error("payment_failed");
  const r = await WebBrowser.openBrowserAsync(init.authorization_url);
  if (r.type === "opened") await waitForForeground(AppState); // Android returns immediately; iOS waits until the person closes the browser
  return verifyPayment(init.reference);
}
