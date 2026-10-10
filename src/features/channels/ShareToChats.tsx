// Instructor: pick other class chats and send the chosen messages into them. They arrive as ordinary messages from the instructor (sent now, no "forwarded" label).
// Needs a connection (the instructor sees at once which chats got them). Retrying after a failure reuses the same message ids, so nothing is posted twice.
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRpc } from "@/data";
import { channelDate, type Channel } from "@/shared/web/channels";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Button, Icon, Sheet, Skeleton, Text, useFeedback } from "@/ui";
import type { ClassMessage } from "./format";
import { sendToChatsDeps } from "./media";
import { sendToChats } from "./sendToChats";

export default function ShareToChats({ open, onClose, fromSession, messages, onDone }: { open: boolean; onClose: () => void; fromSession: string; messages: ClassMessage[]; onDone?: () => void }) {
  const { p } = useTheme(); const { run, toast } = useFeedback();
  const q = useRpc<Channel[]>("instructor_class_channels", {}, { tags: ["messages", "sessions"], ttlMs: 60_000, enabled: open });
  const rows = q.data ? q.data.filter((c) => c.session_id !== fromSession) : null;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const ids = useRef(new Map<string, string>()); // (chat, message) -> client id, kept across retries
  const close = () => { setPicked(new Set()); ids.current = new Map(); onClose(); };
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const count = messages.length; const label = `${count} message${count === 1 ? "" : "s"}`;

  const send = async () => {
    const targets = [...picked]; if (!targets.length || !count) return;
    const r = await run("Sending…", () => sendToChats(messages, targets, sendToChatsDeps(), ids.current), { quiet: true });
    if (!r.ok) return toast(r.message, "bad");
    const { ok, failed } = r.data;
    if (ok.length) toast(`Sent ${label} to ${ok.length} chat${ok.length === 1 ? "" : "s"}`);
    if (failed.length) {
      const names = (rows ?? []).filter((c) => failed.includes(c.session_id)).map((c) => c.course_title).join(", ");
      toast(`Couldn't finish${names ? ` for ${names}` : ""}. Check your connection and try again.`, "bad");
      setPicked(new Set(failed));
      if (!ok.length) return;
    }
    onDone?.(); if (!failed.length) close();
  };

  return (
    <Sheet open={open} onClose={close} title="Send to other chats">
      <View style={{ gap: 12 }}>
        <Text size={14} tone="muted">{`${label} will appear in each chat you pick as if you had just sent ${count === 1 ? "it" : "them"} there. Students in those classes can read ${count === 1 ? "it" : "them"}; they can't reply.`}</Text>
        {rows === null ? <View style={{ gap: 8 }}><Skeleton height={56} /><Skeleton height={56} /></View>
          : rows.length === 0 ? <Text size={14} tone="muted" align="center" style={{ paddingVertical: 24 }}>{"You have no other class chats yet. A class's chat opens when its check-in opens."}</Text>
          : <View style={{ gap: 8 }}>
              {rows.map((c) => {
                const on = picked.has(c.session_id);
                return (
                  <Pressable key={c.session_id} onPress={() => toggle(c.session_id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: p.c.surface, borderWidth: on ? 2 : 1, borderColor: on ? p.c.accent : p.c.line, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? p.c.accent : "transparent", borderWidth: on ? 0 : 1, borderColor: p.c.line }}>{on ? <Icon name="check" size={14} color={p.c.accentInk} /> : null}</View>
                    <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{c.course_title}</Text><Text size={14} tone="muted" numberOfLines={1}>{[c.lesson_title, channelDate(c)].filter(Boolean).join(" · ")}</Text></View>
                    {c.status === "in_progress" ? <Badge tone="ok">Live</Badge> : null}
                  </Pressable>);
              })}
            </View>}
        <Button disabled={!picked.size || !count} onPress={send}>{picked.size ? `Send to ${picked.size} chat${picked.size === 1 ? "" : "s"}` : "Pick a chat"}</Button>
      </View>
    </Sheet>
  );
}
