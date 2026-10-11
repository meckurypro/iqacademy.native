// M7b: the app's own payment-return address (iqacademy://pay/return?reference=…), also what the website's /pay/return page hands back to.
// The payment window normally closes itself and payFlow reads the result; if the OS opens this route instead (Android deep link, or a universal link later) it shows the same
// "confirming your payment" screen as /pay/callback, which asks the server and never claims success without an answer.
import PayCallback from "@/features/enrol/PayCallback";

export default function Route() {
  return <PayCallback />;
}
