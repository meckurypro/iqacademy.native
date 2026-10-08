// Turns an auth deep link (email confirmation, password reset) into a session. Handles both flows so the flow can change without touching screens:
//   implicit : iqacademy://auth/callback#access_token=…&refresh_token=…&type=signup|recovery   → setSession
//   pkce     : iqacademy://auth/callback?code=…                                               → exchangeCodeForSession
//   failure  : …#error=access_denied&error_code=otp_expired&error_description=…              → { error }
import { supabase } from "./supabase";

export type AuthUrlResult = { kind: "session"; type: string | null } | { kind: "error"; message: string } | { kind: "none" };

export const parseAuthUrl = (url: string) => {
  const [base, frag = ""] = url.split("#");
  const query = base.includes("?") ? base.slice(base.indexOf("?") + 1) : "";
  const q = new URLSearchParams(query), h = new URLSearchParams(frag);
  const get = (k: string) => h.get(k) ?? q.get(k);
  return { code: q.get("code"), access: get("access_token"), refresh: get("refresh_token"), type: get("type"), error: get("error_description") ?? get("error"), errorCode: get("error_code") };
};

export async function handleAuthUrl(url: string | null | undefined): Promise<AuthUrlResult> {
  if (!url) return { kind: "none" };
  const p = parseAuthUrl(url);
  if (p.error) return { kind: "error", message: p.errorCode === "otp_expired" ? "That link has expired. Ask for a new one." : decodeURIComponent(p.error.replace(/\+/g, " ")) };
  if (p.code) { const { error } = await supabase.auth.exchangeCodeForSession(p.code); return error ? { kind: "error", message: error.message } : { kind: "session", type: p.type }; }
  if (p.access && p.refresh) { const { error } = await supabase.auth.setSession({ access_token: p.access, refresh_token: p.refresh }); return error ? { kind: "error", message: error.message } : { kind: "session", type: p.type }; }
  return { kind: "none" };
}
