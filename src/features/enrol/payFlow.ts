// Paying in the app, device part. Used by single courses now and by Enrol / instalments later (M7b).
import { AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { online } from "@/data";
import { functionErrorKey, pollPayment, waitForForeground, type PayStatus } from "./pay";

const PAID_TAGS = ["enrolments", "payments", "sessions", "notifications"];

/** Start a Paystack payment for one instalment, show it, and report whether the money arrived. Throws a readable error if the payment could not even be started. */
export async function payInstalment(instalmentId: string): Promise<PayStatus> {
  const init = await online(async (sb) => {
    const { data, error } = await sb.functions.invoke("paystack-init-payment", { body: { instalment_id: instalmentId } });
    if (error || !data?.authorization_url) throw new Error(await functionErrorKey(error, data));
    return data as { authorization_url: string; reference: string };
  });
  const r = await WebBrowser.openBrowserAsync(init.authorization_url);
  if (r.type === "opened") await waitForForeground(AppState); // Android returns immediately; iOS waits until the person closes the browser
  const status = await pollPayment((reference) => online(async (sb) => (await sb.functions.invoke("paystack-verify-payment", { body: { reference } })).data?.status as string | undefined), init.reference);
  if (status === "succeeded") await online(async () => undefined, { invalidates: PAID_TAGS });
  return status;
}
