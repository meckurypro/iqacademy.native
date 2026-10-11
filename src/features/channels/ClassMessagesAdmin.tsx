// Port of web pages/ClassMessagesAdmin.tsx @d14323f: admins see every message instructors sent to their classes and are the only people who can delete one.
// Online only (an admin tool: a stale list is worse than none): the first page is cached for a moment, "Show older" and Delete need a connection.
// A deleted message disappears for every student who received it, and its file is removed from storage.
import { useState } from "react";
import { View } from "react-native";
import { friendly, ok } from "@/core/errors";
import { online, useQuery } from "@/data";
import { Screen } from "@/shell/Screen";
import { Button, Card, Empty, Err, Heading, Skeleton, Text, useFeedback } from "@/ui";
import { ADMIN_PAGE, captionOf, deletePreview, hasMore, isFileNotRemoved, joinPages, newestFirst, olderThan, FILE_NOT_REMOVED } from "./adminLogic";
import { BUCKET, type ClassMessage } from "./format";
import MessageBubble from "./MessageBubble";

const list = (before?: string) => (sb: Parameters<Parameters<typeof online>[0]>[0]) => sb.rpc("admin_class_messages", before ? { p_limit: ADMIN_PAGE, p_before: before } : { p_limit: ADMIN_PAGE });

export default function ClassMessagesAdmin() {
  const { run, confirm, toast } = useFeedback();
  const first = useQuery<{ rows: ClassMessage[]; more: boolean }>({
    key: ["admin-class-messages"], tags: ["messages"], ttlMs: 30_000,
    fn: async (sb) => { const rows = (ok(await list()(sb)) as ClassMessage[]) ?? []; return { rows: newestFirst(rows), more: hasMore(rows) }; },
  });
  const [later, setLater] = useState<ClassMessage[]>([]); const [moreLater, setMoreLater] = useState<boolean | null>(null);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set()); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const msgs = joinPages(first.data?.rows, later, removed);
  const more = moreLater ?? first.data?.more ?? false;

  const older = async () => {
    const before = msgs && olderThan(msgs); if (!before || busy) return; setBusy(true); setErr("");
    try { const rows = (await online(async (sb) => ok(await list(before)(sb)) as ClassMessage[])) ?? []; setLater((o) => [...o, ...newestFirst(rows)]); setMoreLater(hasMore(rows)); }
    catch (e) { setErr(friendly(e)); } finally { setBusy(false); }
  };

  const remove = async (m: ClassMessage) => {
    const yes = await confirm({ title: "Delete this message?", message: `It disappears for every student who received it, and can't be brought back. ${deletePreview(m)}`, confirmLabel: "Delete message", danger: true });
    if (!yes) return;
    const gone = () => setRemoved((s) => new Set(s).add(m.id));
    const r = await run("Deleting message…", () => online(async (sb) => {
      const path = ok(await sb.rpc("admin_delete_class_message", { p_id: m.id })) as string | null;
      gone(); // the message itself is deleted from here on, whatever happens to its file
      if (path) { const { error } = await sb.storage.from(BUCKET).remove([path]); if (error) throw new Error(FILE_NOT_REMOVED); }
    }, { invalidates: ["messages"] }), { quiet: true });
    if (!r.ok) return toast(isFileNotRemoved(r.error) ? "Message deleted, but its file couldn't be removed from storage." : r.message, "bad");
    toast("Message deleted");
  };

  const loadError = first.error && !first.data ? friendly(first.error) : "";
  return (
    <Screen onRefresh={() => { setLater([]); setMoreLater(null); first.refetch(); }}>
      <View style={{ gap: 16 }}>
        <View><Heading size={26} lh={32} accessibilityRole="header">Class messages</Heading><Text size={14} tone="muted">Everything instructors have sent to their classes. Only admins can delete.</Text></View>
        <Err>{err || loadError}</Err>
        {!msgs && !loadError ? <View style={{ gap: 12 }}><Skeleton height={112} /><Skeleton height={112} /></View>
          : msgs && msgs.length === 0 ? (loadError ? null : <Empty icon="messages" title="No class messages yet." />)
          : msgs ? <View style={{ gap: 20 }}>
              {msgs.map((m) => (
                <View key={m.id} style={{ gap: 6 }}>
                  <Text size={12} tone="muted" style={{ paddingHorizontal: 4 }}>{captionOf(m)}</Text>
                  <MessageBubble m={m} footer={<View style={{ alignItems: "flex-end", marginTop: 4 }}><Button variant="ghost" onPress={() => remove(m)} accessibilityLabel={`Delete message from ${m.sender_label}`} style={{ height: 36, paddingHorizontal: 12 }}>Delete</Button></View>} />
                </View>))}
              {more ? <Button variant="secondary" loading={busy} onPress={older}>Show older</Button> : null}
            </View> : null}
        {loadError ? <Card style={{ alignItems: "center" }}><Text size={14} weight="medium" tone="accent" onPress={() => first.refetch()} accessibilityRole="button">Try again</Text></Card> : null}
      </View>
    </Screen>
  );
}
