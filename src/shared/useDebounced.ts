import { useEffect, useState } from "react";
/** The value, but only after it has stopped changing for `ms` (web: setTimeout inside a search effect). */
export function useDebounced<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => { const h = setTimeout(() => setD(value), ms); return () => clearTimeout(h); }, [value, ms]);
  return d;
}
