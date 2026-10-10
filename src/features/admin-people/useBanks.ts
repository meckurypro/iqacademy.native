// The list of Nigerian banks from Paystack, through the admin Edge Function. Cached for a day, so the pickers open instantly and work offline.
// Used by Centres (payout account) and by M10c (refunds).
import { useQuery } from "@/data";

export type Bank = { name: string; code: string };

export function useBanks(enabled: boolean) {
  return useQuery<Bank[]>({
    key: ["banks"], enabled, tags: ["banks"], ttlMs: 24 * 3600_000,
    fn: async (sb) => {
      const { data, error } = await sb.functions.invoke("paystack-create-recipient", { body: { action: "list_banks" } });
      if (error || !data || (data as { error?: string }).error) throw new Error("could_not_load_banks");
      return ((data as { banks?: Bank[] }).banks ?? []);
    },
  });
}
