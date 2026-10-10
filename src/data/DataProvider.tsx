// Builds the per-user data runtime: encrypted DB (or memory-only fallback), query engine, outbox, realtime.
// Rebuilt whenever the signed-in user changes, so one person's cache can never leak into another's.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createUploadHandler, type UploadSb } from "./uploads";
import { readBytes, removeLocal } from "./stage";
import { AppState } from "react-native";
import { getRandomBytes } from "expo-crypto";
import { ok } from "@/core/errors";
import { useSession } from "@/core/session";
import { supabase } from "@/core/supabase";
import { createCacheRepo } from "./db/cacheRepo";
import { toHex } from "./db/keys";
import { createOutboxRepo } from "./db/outboxRepo";
import { openUserDb } from "./db/userDb";
import { isOnline, startNetWatch, subscribeNet } from "./net";
import { createOutbox } from "./outbox/engine";
import { QueryEngine } from "./query/engine";
import { startRealtime } from "./realtime";
import { setRuntime, type Runtime } from "./runtime";

const Ctx = createContext<Runtime | null>(null);
export const useRuntime = () => { const r = useContext(Ctx); if (!r) throw new Error("data hooks need <DataProvider>"); return r; };

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function buildRuntime(uid: string | null): Promise<Runtime> {
  let db: Runtime["db"] = null, degraded = false;
  if (uid) { try { db = (await withTimeout(openUserDb(uid), 8000)).db; } catch (e) { degraded = true; console.warn("[data] encrypted database unavailable, running from memory", e); } }
  const engine = new QueryEngine({ cache: db ? createCacheRepo(db) : null, now: Date.now, isOnline });
  const outbox = db ? createOutbox({
    repo: createOutboxRepo(db), isOnline, now: Date.now, newId: () => toHex(getRandomBytes(16)), onDone: (tags) => engine.invalidate(tags),
    handlers: {
      rpc: async (p: { name: string; args: Record<string, unknown> }) => { ok(await supabase.rpc(p.name, p.args)); },
      upload: createUploadHandler({ sb: supabase as unknown as UploadSb, readBytes, removeLocal }),
    },
  }) : null;
  await outbox?.start();
  // keep the on-disk cache bounded (30 days, 20 MB of payload); fire and forget, a failure only means a bigger cache
  if (db) createCacheRepo(db).prune(Date.now(), { maxAgeMs: 30 * 86_400_000, maxBytes: 20 * 1024 * 1024 }).catch((e) => console.warn("[data] cache prune failed", e));

  let pending = new Set<string>(), timer: ReturnType<typeof setTimeout> | undefined;
  const invalidateSoon = (tags: string[]) => { tags.forEach((t) => pending.add(t)); clearTimeout(timer); timer = setTimeout(() => { const t = [...pending]; pending = new Set(); engine.invalidate(t); }, 400); };
  const stopRealtime = uid ? startRealtime(supabase, uid, invalidateSoon, () => { engine.revalidateActive(); outbox?.flush(); }) : () => {};
  let closed = false;
  return {
    uid, sb: supabase, engine, outbox, db, degraded, invalidateSoon,
    shutdown: async () => { if (closed) return; closed = true; clearTimeout(timer); stopRealtime(); await db?.close().catch(() => {}); },
  };
}

export function DataProvider({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { session, loading } = useSession();
  const uid = session?.user.id ?? null;
  const [rt, setRt] = useState<Runtime | null>(null);

  useEffect(() => {
    if (loading) return;
    let dead = false, built: Runtime | null = null;
    buildRuntime(uid).then((r) => { if (dead) { r.shutdown(); return; } built = r; setRuntime(r); setRt(r); });
    return () => { dead = true; setRuntime(null); setRt(null); built?.shutdown(); };
  }, [uid, loading]);

  // coming back (to the app, or to the network) refreshes what is on screen and sends anything queued
  useEffect(() => {
    const resume = () => { rt?.engine.revalidateActive(); rt?.outbox?.flush(); };
    const stopNet = startNetWatch();
    const unsubNet = subscribeNet(() => { if (isOnline()) resume(); });
    const app = AppState.addEventListener("change", (s) => { if (s === "active") resume(); });
    return () => { stopNet(); unsubNet(); app.remove(); };
  }, [rt]);

  return rt ? <Ctx.Provider value={rt}>{children}</Ctx.Provider> : <>{fallback}</>;
}
