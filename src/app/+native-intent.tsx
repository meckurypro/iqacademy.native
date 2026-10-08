// Runs for every incoming system URL (cold start and while running), before expo-router parses it.
// Returning null leaves the app where it is (documented in expo-router's types: "no redirection occurs and the app stays on the current path").
// Reason: src/shell/incomingLink.ts.
import { guardIncomingUrl } from "@/shell/incomingLink";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try { return guardIncomingUrl(path); } catch { return null; } // a throw here can crash the app
}
