// Port of web pages/ClassChannel.tsx, first part: one class's channel. Students who joined the class read it; the class's instructor reads and writes. Nobody replies.
// Not yet ported: rating card after the class, attachments in the composer, selecting messages to send on to other classes, copy / share actions.
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { ok } from "@/core/errors";
import { getRuntime, mutate, online, useOnline, useOutbox, useQuery, useRealtime, useRpc } from "@/data";
import { ChatFrame } from "@/shell/ChatFrame";
import { channelDate, type Channel } from "@/shared/web/channels";
import { dayOf, relativeDay } from "@/shared/web/time";
import { useTicker } from "@/shared/useTicker";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Badge, Empty, Icon, Skeleton, Text } from "@/ui";
import ChatBubble, { PendingBubble } from "./ChatBubble";
import Composer from "./Composer";
import { PAGE, layoutFlags, mergeMessages, nextMessages, pendingForSession, type ClassMessage, type PendingRow } from "./format";

const dayLabel = (d: string) => relativeDay(d, { weekday: "long", day: "numeric", month: "long" });
const Chip = ({ children }: { children: string }) => { const { p } = useTheme(); return <View style={{ alignSelf: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: p.a("surface", 0.85) }}><Text size={11} weight="medium" tone="muted" align="center">{children}</Text></View>; };

export default function ClassChannel({ id }: { id: string }) {
  const router = useRouter(); const { p } = useTheme();
  const { session, roles } = useAuth(); const uid = session?.user.id;
  const teaching = roles.some((r) => r.role === "instructor");
  const at = useTicker(60_000); const online_ = useOnline(); const outbox = useOutbox();
  const [older, setOlder] = useState<ClassMessage[]>([]); const [noMore, setNoMore] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState<PendingRow[]>([]);

  const chans = useRpc<Channel[]>(teaching ? "instructor_class_channels" : "my_class_channels", {}, { tags: ["messages", "sessions", "attendance"], ttlMs: 60_000, enabled: !!uid });
  const info = chans.data?.find((c) => c.session_id === id);
  const locked = !teaching && !!info?.locked;

  // newest page, merged into what is held (a delete shows up because the newest window is re-read; older pages loaded by "Show earlier" are kept)
  const q = useQuery<ClassMessage[]>({
    key: ["channel-messages", id], enabled: !!uid && !!id && !locked, tags: ["messages"], ttlMs: 30_000,
    fn: async (sb, prev) => nextMessages(prev, (ok(await sb.rpc("class_channel_messages", { p_session_id: id, p_limit: PAGE })) as ClassMessage[]) ?? []),
  });
  useRealtime({ table: "class_messages", event: "DELETE", tags: ["messages"], enabled: !!uid });
  useRealtime({ table: "class_sessions", filter: `id=eq.${id}`, event: "UPDATE", tags: ["sessions"], enabled: !!uid });

  const latest = q.data;
  const msgs = latest ? mergeMessages(older, latest) : null;

  // students: tell the server we have read up to here (once per newest message; queued if offline)
  const lastMarked = useRef<string | null>(null); const newestId = latest?.length ? latest[latest.length - 1].id : null;
  useEffect(() => {
    if (teaching || !newestId || lastMarked.current === newestId) return; lastMarked.current = newestId;
    mutate.rpc("mark_channel_read", { p_session_id: id }).catch(() => { lastMarked.current = null; });
  }, [teaching, newestId, id]);

  // this chat's unsent messages, from the outbox
  useEffect(() => {
    let live = true;
    getRuntime()?.outbox?.list().then((rows) => { if (live) setPending(pendingForSession(rows, id)); });
    return () => { live = false; };
  }, [id, outbox.pending, outbox.failed, outbox.dead]);
  const retry = async (rid: string) => { await getRuntime()?.outbox?.revive(rid); await getRuntime()?.outbox?.flush(); };
  const discard = async (rid: string) => { await getRuntime()?.outbox?.discard(rid); setPending((x) => x.filter((r) => r.id !== rid)); };

  const loadOlder = async () => {
    if (!msgs?.length || loadingMore) return; setLoadingMore(true);
    try {
      const rows = await online(async (sb) => (ok(await sb.rpc("class_channel_messages", { p_session_id: id, p_limit: PAGE, p_before: msgs[0].created_at })) as ClassMessage[]) ?? []);
      setOlder((o) => mergeMessages(o, rows)); if (rows.length < PAGE) setNoMore(true);
    } catch { /* offline or failed: the button stays so they can try again */ } finally { setLoadingMore(false); }
  };

  const back = <Pressable onPress={() => router.navigate("/messages")} accessibilityRole="button" accessibilityLabel="Back to messages" hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}><Icon name="arrowLeft" size={20} color={p.c.ink} /></Pressable>;

  if (chans.data && !info) return (
    <ChatFrame top={<View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>{back}</View>}>
      <Empty icon="messages" title="This channel isn't available" hint="Channels are for the students who checked in to a class, and its instructor." />
    </ChatFrame>);

  const top = info ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.c.line }}>
      {back}<Avatar name={info.course_title} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold" numberOfLines={1}>{info.course_title}</Text>
        <Text size={12} tone="muted" numberOfLines={1}>{[teaching ? `${info.joined ?? 0} joined` : info.instructor_first_name ?? "Your instructor", info.lesson_title, channelDate(info)].filter(Boolean).join(" · ")}</Text>
      </View>
      {info.status === "in_progress" ? <Badge tone="ok">Live</Badge> : null}{locked ? <Badge tone="muted">Closed</Badge> : null}
    </View>) : <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>{back}</View>;

  return (
    <ChatFrame top={top} scrollKey={`${newestId}:${pending.length}`} footer={teaching && info ? <Composer sessionId={id} onSent={() => q.refetch()} /> : undefined}>
      {!info || (!locked && msgs === null) ? <View style={{ gap: 12, paddingVertical: 12 }}><Skeleton height={32} /><Skeleton height={96} /><Skeleton height={64} /></View>
        : locked ? (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 48, paddingHorizontal: 24 }}>
            <Icon name="lock" size={28} color={p.c.muted} /><Text size={18} weight="medium">This chat is closed</Text>
            <Text size={14} tone="muted" align="center">Your cohort has ended, so the messages in this channel are no longer available to you. Your instructor can still open it.</Text>
          </View>)
        : <>
            <Chip>{teaching ? "Students can't reply to this channel" : "Only your instructor can post here"}</Chip>
            {!noMore && (msgs?.length ?? 0) >= PAGE ? <Text size={13} weight="medium" tone="accent" align="center" onPress={loadOlder} style={{ paddingVertical: 12 }}>{loadingMore ? "Loading…" : "Show earlier messages"}</Text> : null}
            {msgs && msgs.length === 0 && !pending.length ? <Text size={14} tone="muted" align="center" style={{ marginTop: 24, paddingHorizontal: 32 }}>{teaching ? "Nothing sent to this class yet." : "No messages yet. They'll appear here as they're sent, during and after class."}</Text> : null}
            {(msgs ?? []).map((m, i, all) => {
              const { newDay, first } = layoutFlags(all, i, dayOf); const out = teaching && m.sender_label !== "IQ Academy";
              return (
                <View key={m.id}>
                  {newDay ? <View style={{ marginTop: 16, marginBottom: 4 }}><Chip>{dayLabel(m.created_at)}</Chip></View> : null}
                  <ChatBubble m={m} out={out} first={first} showName={first && !out} restricted={!teaching} at={at} />
                </View>);
            })}
            {pending.map((r) => <PendingBubble key={r.id} body={r.body} status={r.status} onRetry={() => retry(r.id)} onDiscard={() => discard(r.id)} />)}
            {teaching && !online_ ? <Text size={12} tone="muted" align="center" style={{ marginTop: 8 }}>{"You're offline. Messages you write are sent when the connection is back."}</Text> : null}
          </>}
    </ChatFrame>
  );
}
