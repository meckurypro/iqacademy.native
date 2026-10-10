/** What an Edge Function / Supabase returned when it refused, as a message key friendly() understands. */
export async function functionErrorKey(error: unknown, data: unknown): Promise<string> {
  const d = data as { error?: string } | null;
  if (d?.error) return d.error;
  try { const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context; const j = await ctx?.json?.(); if (j?.error) return j.error; } catch { /* body not readable */ }
  return (error as { message?: string } | null)?.message ?? "payment_failed";
}
