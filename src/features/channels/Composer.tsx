// The instructor's message box (text only for now; attachments and "send to other chats" are not ported yet). Sending goes through the outbox:
// online it is sent at once; offline it waits and keeps its place in line. The server ignores a repeat of the same message (client id), so a retry never doubles it.
import { useState } from "react";
import { TextInput, View } from "react-native";
import { friendly } from "@/core/errors";
import { mutate } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Icon, useFeedback } from "@/ui";

export const MAX_BODY = 4000; // the database refuses longer messages

export default function Composer({ sessionId, onSent }: { sessionId: string; onSent: (status: "done" | "queued") => void }) {
  const { p } = useTheme(); const { toast } = useFeedback();
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const body = text.trim();
  const send = async () => {
    if (!body || busy) return; setBusy(true);
    try {
      const r = await mutate.rpc("send_class_message", { p_session_id: sessionId, p_body: body, p_media_path: null, p_media_name: null, p_media_mime: null, p_media_size: null });
      setText(""); onSent(r.status);
    } catch (e) { toast(friendly(e), "bad"); } // the text stays in the box so nothing is lost
    finally { setBusy(false); }
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: p.c.line, backgroundColor: p.c.bg, maxWidth: 672, width: "100%", alignSelf: "center" }}>
      <TextInput value={text} onChangeText={setText} multiline maxLength={MAX_BODY} placeholder="Message your class" placeholderTextColor={p.c.muted} accessibilityLabel="Message"
        style={{ flex: 1, maxHeight: 140, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: p.c.ink, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line }} />
      <Button onPress={send} loading={busy} disabled={!body} accessibilityLabel="Send message" style={{ width: 44, height: 44, paddingHorizontal: 0 }}><Icon name="send" size={18} color={p.c.accentInk} /></Button>
    </View>
  );
}
