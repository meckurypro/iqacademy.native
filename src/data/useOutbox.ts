import { useSyncExternalStore } from "react";
import { useRuntime } from "./DataProvider";
import type { Counts } from "./db/outboxRepo";

const NONE: Counts = { pending: 0, failed: 0, dead: 0 };
/** How many actions are waiting to be sent. Drives the "Pending (n)" indicator. */
export function useOutbox(): Counts & { total: number } {
  const { outbox } = useRuntime();
  const c = useSyncExternalStore((cb) => outbox?.subscribe(cb) ?? (() => {}), () => outbox?.snapshot() ?? NONE);
  return { ...c, total: c.pending + c.failed };
}
