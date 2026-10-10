// The instructor's message box: text and/or one file of any kind (up to 25 MB), sent to the class. Sending goes through the outbox: online it is sent at once;
// offline it waits and keeps its place in line. The message carries a client id chosen once, so a retry never posts it twice.
import { useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { friendly } from "@/core/errors";
import { MAX_MEDIA_BYTES, chatMediaJob, mutate, queueUpload } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Icon, Sheet, Text, useFeedback } from "@/ui";
import { fileSize, isImageMime } from "./format";
import { pickFile, pickPhoto, type Picked } from "./media";

export const MAX_BODY = 4000; // the database refuses longer messages

export default function Composer({ sessionId, onSent }: { sessionId: string; onSent: (status: "done" | "queued") => void }) {
  const { p } = useTheme(); const { toast } = useFeedback();
  const [text, setText] = useState(""); const [file, setFile] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false); const [menu, setMenu] = useState(false);
  const body = text.trim(); const canSend = !!body || !!file;

  const choose = async (pick: () => Promise<Picked | null>) => {
    setMenu(false);
    try {
      const f = await pick(); if (!f) return;
      if (f.size <= 0 || f.size > MAX_MEDIA_BYTES) return toast(friendly(new Error("invalid_media")), "bad");
      setFile(f);
    } catch (e) { toast(friendly(e), "bad"); }
  };
  const send = async () => {
    if (!canSend || busy) return; setBusy(true);
    try {
      const r = file
        ? await queueUpload(chatMediaJob({ sessionId, body, name: file.name, mime: file.mime, size: file.size, id: randomUUID() }), file.uri, { tags: ["messages"] })
        : await mutate.rpc("send_class_message", { p_session_id: sessionId, p_body: body, p_media_path: null, p_media_name: null, p_media_mime: null, p_media_size: null });
      setText(""); setFile(null); onSent(r.status);
    } catch (e) { toast(friendly(e), "bad"); } // the text and the file stay in place so nothing is lost
    finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: p.c.line, backgroundColor: p.c.bg, maxWidth: 672, width: "100%", alignSelf: "center" }}>
      {file ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 16, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line }}>
          {isImageMime(file.mime) ? <Image source={{ uri: file.uri }} style={{ width: 44, height: 44, borderRadius: 8 }} accessibilityIgnoresInvertColors />
            : <View style={{ width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: p.c.sunken }}><Icon name="file" size={20} color={p.c.muted} /></View>}
          <View style={{ flex: 1, minWidth: 0 }}><Text size={14} numberOfLines={1}>{file.name}</Text><Text size={12} tone="muted">{fileSize(file.size)}</Text></View>
          <Pressable onPress={() => setFile(null)} accessibilityRole="button" accessibilityLabel="Remove file" hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}><Icon name="close" size={16} color={p.c.muted} /></Pressable>
        </View>) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel={file ? "Change file" : "Attach a file"}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          <Icon name="file" size={20} color={p.c.muted} />
        </Pressable>
        <TextInput value={text} onChangeText={setText} multiline maxLength={MAX_BODY} placeholder="Message your class" placeholderTextColor={p.c.muted} accessibilityLabel="Message"
          style={{ flex: 1, maxHeight: 140, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: p.c.ink, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line }} />
        <Button onPress={send} loading={busy} disabled={!canSend} accessibilityLabel="Send message" style={{ width: 44, height: 44, paddingHorizontal: 0 }}><Icon name="send" size={18} color={p.c.accentInk} /></Button>
      </View>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Attach">
        <View style={{ gap: 10 }}>
          <Button variant="secondary" onPress={() => choose(pickPhoto)}>Photo or video</Button>
          <Button variant="secondary" onPress={() => choose(pickFile)}>File</Button>
          <Text size={12} tone="muted" align="center">Any kind of file, up to 25 MB. One file per message.</Text>
        </View>
      </Sheet>
    </View>
  );
}
