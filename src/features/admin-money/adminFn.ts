// Calls an admin Edge Function (process-refund, process-payouts, paystack-create-recipient) the way the web does. The shared invokeFunction keeps only the error key;
// refunds and payouts also need the server's `detail` (for example Paystack's own message), so this keeps it. Online-only and never queued: it moves money.
import { UserMessage } from "@/core/errors";
import { online } from "@/data";

type Body = { error?: string; detail?: string };

export async function callAdminFunction<T = Record<string, unknown>>(name: string, body: object, invalidates?: string[]): Promise<T> {
  return online(async (sb) => {
    const { data, error } = await sb.functions.invoke(name, { body });
    let b = (data ?? null) as Body | null;
    if (error && !b?.error) { try { b = (await (error as { context?: { json?: () => Promise<Body> } }).context?.json?.()) ?? null; } catch { /* body not readable */ } }
    if (error || b?.error) {
      if (b?.detail) throw new UserMessage(String(b.detail));
      if (String(b?.error ?? "").includes("invalid_refund_amount")) throw new UserMessage("That's more than can still be refunded.");
      throw new Error(b?.error ?? (error as Error | null)?.message ?? "payment_failed");
    }
    return data as T;
  }, { invalidates });
}
