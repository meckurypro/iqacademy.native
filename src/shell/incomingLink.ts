// Guard for deep links, applied by expo-router's `redirectSystemPath` hook (src/app/+native-intent.tsx) BEFORE the router parses them.
//
// Why: expo-router 57 → query-string 7.1.3 → decode-uri-component 0.2.2 (GHSA-vcc3-ghjq-m6fr, "<= 0.4.2", no non-major fix: expo-router 58).
// Measured on Node 22 (desktop): a query of repeated "%FF%FE" costs 135 ms at 256 chars, 575 ms at 512, 2.4 s at 1024 and 10.9 s at 2048
// (quadratic). A phone is slower. One crafted link could freeze the app, so crafted links are dropped.
//
// What is blocked: more than MAX_ESCAPES "%" characters, or a link longer than MAX_LENGTH. Real links have almost no escapes and JWTs
// (auth callback fragments) are base64url, which never contains "%". At 40 escapes the worst case is ~120 characters, a few milliseconds.
export const MAX_ESCAPES = 40;
export const MAX_LENGTH = 8192;

export function guardIncomingUrl(url: string): string | null {
  if (url.length > MAX_LENGTH) return null;
  let escapes = 0;
  for (let i = 0; i < url.length; i++) if (url.charCodeAt(i) === 37 && ++escapes > MAX_ESCAPES) return null;
  return url;
}
