import { useEffect, useState } from "react";

/** Keep something mounted while its exit animation plays. Returns true while open, and for `exitMs` after closing. */
export function useExitMount(open: boolean, exitMs = 220) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true); // derived during render: the React-sanctioned way to adjust state on a prop change
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setMounted(false), exitMs); // not synchronous: fine
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return open || mounted;
}
