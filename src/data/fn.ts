// Call an Edge Function (online only). Throws Error(<message key>) when the function refuses, so friendly() can word it.
import { functionErrorKey } from "./fnError";
import { online } from "./mutate";

export async function invokeFunction<T = unknown>(name: string, body: Record<string, unknown>, opts: { invalidates?: string[] } = {}): Promise<T> {
  return online(async (sb) => {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error || (data as { error?: string } | null)?.error) throw new Error(await functionErrorKey(error, data));
    return data as T;
  }, opts);
}
