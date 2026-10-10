// Port of web pages/Notifications.tsx. The list is kept on the phone and refreshed by asking only for what is newer ("changes since"), so it opens
// instantly and works offline. Opening it marks everything read (queued if offline); what was unread when you opened it stays highlighted until you leave.
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "@/core/auth";
import { ok } from "@/core/errors";
import { mutate, online, useDeltaQuery } from "@/data";
import { useTicker } from "@/shared/useTicker";
import { Avatar, Button, Card, Empty, PageHeader, Skeleton, Text, useFeedback } from "@/ui";
import { PAGE, noteLink, reminderTitle, when, type Note } from "./format";

const COLS = "id,title,body,read_at,created_at,sender_label,type,data";
const spec = { idOf: (n: Note) => n.id, cursorOf: (n: Note) => n.created_at, order: "desc" as const };

function Sender({ label }: { label: string | null }) {
  const name = label || "IQ Academy";
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}><Avatar name={name.replace(/^Instructor\s+/, "")} size={24} /><Text size={12} weight="semibold" numberOfLines={1}>{name}</Text></View>;
}

export default function Notifications() {
  const { session } = useAuth(); const uid = session?.user.id; const router = useRouter(); const tick = useTicker(30000); const { run } = useFeedback();
  const [reported, setReported] = useState<Set<string>>(new Set()); // hand check-ins the student has just said were not them
  const [fresh, setFresh] = useState<Set<string>>(new Set());       // unread when this page opened, kept highlighted until you leave
  const [older, setOlder] = useState<Note[]>([]); const [noMore, setNoMore] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const marked = useRef(false);

  const q = useDeltaQuery<Note>({
    key: ["notifications", uid], enabled: !!uid, tags: ["notifications"], ttlMs: 30_000, fullEveryMs: 2 * 60_000, spec,
    fetchAll: async (sb) => (ok(await sb.from("notifications").select(COLS).order("created_at", { ascending: false }).limit(PAGE)) as Note[]) ?? [],
    fetchSince: async (sb, cursor) => (ok(await sb.from("notifications").select(COLS).gte("created_at", cursor).order("created_at", { ascending: false }).limit(PAGE)) as Note[]) ?? [],
  });
  const { data: rows, refetch } = q;

  useEffect(() => {
    if (!rows) return;
    const unread = rows.filter((n) => !n.read_at);
    if (!unread.length) return;
    queueMicrotask(() => setFresh((f) => { const n = new Set(f); unread.forEach((x) => n.add(x.id)); return n; }));
    if (marked.current) return; marked.current = true;
    mutate.rpc("mark_notifications_read").then((r) => { if (r.status === "done") refetch(true); }).catch(() => { marked.current = false; });
  }, [rows, refetch]);

  const notes = rows ? [...rows, ...older.filter((o) => !rows.some((r) => r.id === o.id))] : null;
  const showOlder = !!notes && !noMore && notes.length >= PAGE;

  const dispute = async (n: Note) => {
    const r = await run("Reporting…", () => mutate.rpc("dispute_hand_check_in", { p_log_id: n.data!.log_id }), { success: "Reported. The check-in was undone." });
    if (r.ok) setReported((s) => new Set(s).add(n.id));
  };
  const loadOlder = async () => {
    if (!notes?.length) return; setLoadingMore(true);
    try {
      const rowsOlder = await online(async (sb) => (ok(await sb.from("notifications").select(COLS).lt("created_at", notes[notes.length - 1].created_at).order("created_at", { ascending: false }).limit(PAGE)) as Note[]) ?? []);
      setOlder((o) => [...o, ...rowsOlder]); if (rowsOlder.length < PAGE) setNoMore(true);
    } catch { /* offline or failed: the button stays so they can try again */ } finally { setLoadingMore(false); }
  };

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Notifications" />
      {notes === null ? <View style={{ gap: 12 }}><Skeleton height={96} /><Skeleton height={96} /><Skeleton height={96} /></View>
        : notes.length === 0 ? <Empty icon="bell" title="You're all caught up" hint="New updates will show up here." />
        : <View style={{ gap: 12 }}>
            {notes.map((n) => {
              const link = noteLink(n.type);
              return (
                <Card key={n.id} variant={fresh.has(n.id) ? "glass" : "surface"} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <Sender label={n.sender_label} />
                    <Text size={12} tone="muted">{fresh.has(n.id) ? "● " : ""}{when(n.created_at, tick)}</Text>
                  </View>
                  <Text weight="medium">{reminderTitle(n, tick)}</Text>
                  {link ? <Pressable accessibilityRole="link" onPress={() => router.navigate(link.to as Href)}><Text size={14} weight="medium" tone="accent">{link.label}</Text></Pressable> : null}
                  {n.type === "hand_check_in" && n.data?.log_id ? (n.data.disputed || reported.has(n.id)
                    ? <Text size={14} weight="medium" tone="muted">{"You said this wasn't you. The check-in was undone and the admins were told."}</Text>
                    : <Button variant="secondary" style={{ height: 36 }} onPress={() => dispute(n)}>{"That wasn't me"}</Button>) : null}
                  {n.body ? <Text size={14} tone="muted" selectable>{n.body}</Text> : null}
                </Card>);
            })}
            {showOlder ? <Button variant="secondary" loading={loadingMore} onPress={loadOlder}>Show older</Button> : null}
          </View>}
    </View>
  );
}
