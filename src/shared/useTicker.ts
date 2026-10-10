// Re-renders every `ms` with the server-corrected time, so "5 min ago" and "Class in 4 minutes" keep moving. Port of web classClock.useTicker.
import { useEffect, useState } from "react";
import { now } from "./web/time";

export function useTicker(ms: number): number {
  const [t, setT] = useState(() => now());
  useEffect(() => { const id = setInterval(() => setT(now()), ms); return () => clearInterval(id); }, [ms]);
  return t;
}
