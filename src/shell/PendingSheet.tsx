// "Pending (n)": every change waiting to be sent, with retry / discard for the ones that gave up. Sits in the header, only shown when there is something to show.
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { friendly } from "@/core/errors";
import { getRuntime, useOnline, useOutbox } from "@/data";
import { labelForRow } from "@/data/policies";
import { removeLocal } from "@/data/stage";
import type { UploadPayload } from "@/data/uploads";
import type { OutboxRow } from "@/data/db/outboxRepo";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Button, Card, Icon, Sheet, Text, useFeedback } from "@/ui";

const when = (ms: number) => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`; };

export function PendingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rt = getRuntime(); const c = useOutbox(); const online = useOnline(); const { confirm } = useFeedback();
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [tick, setTick] = useState(0); const load = useCallback(async () => { setTick((t) => t + 1); }, []);
  useEffect(() => {
    if (!open) return; let alive = true;
    rt?.outbox?.list().then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [open, rt, tick, c.pending, c.failed, c.dead]);
  const retry = async (id: string) => { await rt?.outbox?.revive(id); await rt?.outbox?.flush(); await load(); };
  const drop = async (r: OutboxRow) => { if (await confirm({ title: "Discard this change?", message: `"${labelForRow(r)}" will not be sent.`, confirmLabel: "Discard", danger: true })) { await rt?.outbox?.discard(r.id); if (r.kind === "upload") await removeLocal((r.payload as UploadPayload).localUri).catch(() => {}); await load(); } };
  return (
    <Sheet open={open} onClose={onClose} title="Waiting to send">
      <View style={{ gap: 10 }}>
        {!rows.length && <Text tone="muted">Nothing is waiting. Everything has been sent.</Text>}
        {!online && rows.length > 0 && <Text size={14} tone="muted">You are offline. These will be sent when the connection is back.</Text>}
        {rows.map((r) => (
          <Card key={r.id} variant="sunken">
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text weight="medium" style={{ flex: 1 }}>{labelForRow(r)}</Text>
                <Badge tone={r.status === "dead" ? "bad" : r.status === "failed" ? "warn" : "info"}>{r.status === "dead" ? "Not sent" : r.status === "failed" ? "Will retry" : "Waiting"}</Badge>
              </View>
              <Text size={13} tone="muted">Saved {when(r.created_at)}{r.last_error ? ` · ${friendly(new Error(r.last_error))}` : ""}</Text>
              {r.status !== "pending" && r.status !== "sending" && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button variant="secondary" style={{ flex: 1, height: 40 }} onPress={() => retry(r.id)}>Try again</Button>
                  <Button variant="ghost" style={{ height: 40 }} onPress={() => drop(r)}>Discard</Button>
                </View>
              )}
            </View>
          </Card>
        ))}
      </View>
    </Sheet>
  );
}

/** Header chip. Hidden when the queue is empty. */
export function PendingChip() {
  const { p } = useTheme(); const c = useOutbox(); const [open, setOpen] = useState(false);
  const n = c.total + c.dead; if (n === 0 && !open) return null;
  const bad = c.dead > 0;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Pending changes, ${n}`} onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: pressed ? p.c.sunken : bad ? p.a("bad", 0.12) : p.c.sunken })}>
        <Icon name="send" size={15} color={bad ? p.c.bad : p.a("ink", 0.8)} />
        <Text size={13} weight="medium" style={{ color: bad ? p.c.bad : p.c.ink }}>Pending ({n})</Text>
      </Pressable>
      <PendingSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
