// The web app calls supabase.rpc("server_now") inside time.ts. Shared libs must not import the client, so the
// core layer injects the fetcher once at start-up (src/core/clock.ts).
export type ServerNowResult = { data: unknown; error: unknown };
let fetcher: () => Promise<ServerNowResult> = async () => ({ data: null, error: new Error("clock source not set") });
export const setServerNowFetcher = (f: () => Promise<ServerNowResult>) => { fetcher = f; };
export const fetchServerNow = () => fetcher();
