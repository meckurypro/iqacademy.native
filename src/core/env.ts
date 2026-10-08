// Build-time config. EXPO_PUBLIC_* values are inlined by Metro, so they must be referenced statically (no dynamic process.env[...]).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anon,
  /** Without these the app shows a configuration screen instead of crashing (same idea as the web "supabaseConfigured" check). */
  configured: Boolean(url && anon),
  /** Public web origin for invite QR codes, Paystack return page and share links. Undefined until configured. */
  webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, ""),
  /** 'implicit' keeps "open the email link on any device" working like the web; 'pkce' is stricter. ADR-003 / spike S3. */
  authFlow: (process.env.EXPO_PUBLIC_AUTH_FLOW === "pkce" ? "pkce" : "implicit") as "implicit" | "pkce",
  /** Dev-only screens (component gallery, spikes). */
  devTools: __DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === "1",
} as const;
