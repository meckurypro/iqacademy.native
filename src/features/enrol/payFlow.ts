// Paying in the app, device part. Used by single courses now and by Enrol / instalments later (M7b).
import { AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { invokeFunction, online } from "@/data";
import { pollPayment, waitForForeground, type PayStatus } from "./pay";

const PAID_TAGS = ["enrolments", "payments", "sessions", "notifications"];

/** Start a Paystack payment for one instalment, show it, and report whether the money arrived. Throws a readable error if the payment could not even be started. */
export async function payInstalment(instalmentId: string): Promise<PayStatus> {
  const init = await invokeFunction<{ authorization_url?: string; reference: string }>("paystack-init-payment", { instalment_id: instalmentId });
  if (!init.authorization_url) throw new Error("payment_failed");
  const r = await WebBrowser.openBrowserAsync(init.authorization_url);
  if (r.type === "opened") await waitForForeground(AppState); // Android returns immediately; iOS waits until the person closes the browser
  const status = await pollPayment((reference) => online(async (sb) => (await sb.functions.invoke("paystack-verify-payment", { body: { reference } })).data?.status as string | undefined), init.reference);
  if (status === "succeeded") await online(async () => undefined, { invalidates: PAID_TAGS });
  return status;
}
