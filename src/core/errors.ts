// One import for everything that turns a failure into words people can read. Wording lives in the web app and is synced (scripts/sync-web.mjs).
import { friendly as webFriendly, UserMessage } from "@/shared/web/errors";
export { rawMessage, UserMessage, MESSAGES } from "@/shared/web/errors";
export { naira } from "@/shared/format";
export { ok, touched, mapDuplicate, sleep } from "@/shared/web/db";

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|timed out|timeout/i;
/** True for "the request never reached the server" (offline, DNS, timeout). RN's fetch says "Network request failed". */
export const isNetworkError = (e: unknown) => NETWORK.test(String((e as { message?: string } | null)?.message ?? e ?? ""));

const NO_NET = "No internet connection. Check it and try again.";
/** Web's friendly() plus React Native's own offline wording ("Network request failed"), which the browser regex doesn't know. */
export const friendly = (e: unknown) => (!(e instanceof UserMessage) && isNetworkError(e) ? NO_NET : webFriendly(e));
