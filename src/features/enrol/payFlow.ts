// Paying in the app, device part. Used by single courses now and by Enrol / instalments later (M7b).
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { env } from "@/core/env";
import { invokeFunction, online } from "@/data";
import { payReturn, pollPayment, type PayStatus } from "./pay";

const PAID_TAGS = ["enrolments", "payments", "sessions", "notifications"];

/** Ask the server whether the money for this reference arrived (up to 6 asks, 2.5 s apart: the bank can take a moment). Refreshes what a payment changes once it has. */
export async function verifyPayment(reference: string): Promise<PayStatus> {
  const status = await pollPayment((ref) => online(async (sb) => (await sb.functions.invoke("paystack-verify-payment", { body: { reference: ref } })).data?.status as string | undefined), reference);
  if (status === "succeeded") await online(async () => undefined, { invalidates: PAID_TAGS });
  return status;
}

/** Start a Paystack payment for one instalment, show it, and report whether the money arrived. Throws a readable error if the payment could not even be started.
 *  Paystack opens in the system's secure browser window (not the website, no second sign-in). When Paystack is done, the website's /pay/return page sends the window back to
 *  iqacademy://pay/return, which closes it; if the person closes it first, or the page cannot hand back, we get here the same way. Either way the answer comes from the server. */
export async function payInstalment(instalmentId: string): Promise<PayStatus> {
  const { callbackUrl, redirectUrl } = payReturn(env.webBaseUrl, Linking.createURL("pay/return"));
  const init = await invokeFunction<{ authorization_url?: string; reference: string }>("paystack-init-payment", { instalment_id: instalmentId, ...(callbackUrl ? { callback_url: callbackUrl } : {}) });
  if (!init.authorization_url) throw new Error("payment_failed");
  // preferEphemeralSession: a payment page should not share the phone browser's cookies, and iOS skips its "wants to use … to sign in" prompt for it
  await WebBrowser.openAuthSessionAsync(init.authorization_url, redirectUrl, { preferEphemeralSession: true });
  return verifyPayment(init.reference);
}
