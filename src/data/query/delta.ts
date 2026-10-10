// "Changes since": keep a list on the phone and ask the server only for rows newer than the newest one we hold.
// Pure functions, so the rules are tested without a network. Deletions cannot be seen this way, so a full reload is forced every `fullEveryMs`
// and whenever the caller asks (pull to refresh).
export type DeltaSpec<T> = {
  idOf: (row: T) => string;
  /** Sortable cursor of a row (an ISO timestamp works). Newest = largest. */
  cursorOf: (row: T) => string;
  /** Oldest first or newest first in the list the screen shows. */
  order: "asc" | "desc";
};

export type DeltaBox<T> = { rows: T[]; cursor: string | null; fullAt: number };
export const emptyBox = <T,>(): DeltaBox<T> => ({ rows: [], cursor: null, fullAt: 0 });

const newest = <T,>(rows: T[], spec: DeltaSpec<T>) => rows.reduce<string | null>((m, r) => { const c = spec.cursorOf(r); return m == null || c > m ? c : m; }, null);

/** Merge fresh rows into what we hold: same id replaces, new ids are added, order is kept. */
export function mergeRows<T>(held: T[], fresh: T[], spec: DeltaSpec<T>): T[] {
  const byId = new Map(held.map((r) => [spec.idOf(r), r] as const));
  for (const r of fresh) byId.set(spec.idOf(r), r);
  const all = [...byId.values()].sort((a, b) => (spec.cursorOf(a) < spec.cursorOf(b) ? -1 : spec.cursorOf(a) > spec.cursorOf(b) ? 1 : 0));
  return spec.order === "asc" ? all : all.reverse();
}

export const needsFull = (prev: DeltaBox<unknown> | undefined, now: number, fullEveryMs: number, force = false) =>
  force || !prev || prev.cursor == null || now - prev.fullAt >= fullEveryMs;

/** One refresh step: a full load when needed, otherwise only rows at or after the cursor (inclusive, so rows sharing a timestamp are never missed). */
export async function refreshDelta<T>(o: {
  prev: DeltaBox<T> | undefined; spec: DeltaSpec<T>; now: number; fullEveryMs: number; force?: boolean;
  fetchAll: () => Promise<T[]>; fetchSince: (cursor: string) => Promise<T[]>;
}): Promise<DeltaBox<T>> {
  if (needsFull(o.prev, o.now, o.fullEveryMs, o.force)) {
    const rows = await o.fetchAll();
    const sorted = mergeRows([], rows, o.spec);
    return { rows: sorted, cursor: newest(rows, o.spec), fullAt: o.now };
  }
  const prev = o.prev as DeltaBox<T>;
  const fresh = await o.fetchSince(prev.cursor as string);
  const rows = mergeRows(prev.rows, fresh, o.spec);
  return { rows, cursor: newest(rows, o.spec), fullAt: prev.fullAt };
}
