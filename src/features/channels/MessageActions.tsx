// What you can do with one message (web: the sheet that opens when you tap a bubble). Students may copy or share for two hours after a message arrives;
// downloading a file is always allowed; the instructor can also send the message on to other chats or start selecting several.
import { useState } from "react";
import { View } from "react-native";
import { friendly } from "@/core/errors";
import { now } from "@/shared/web/time";
import { Button, Sheet, Text, useFeedback } from "@/ui";
import { canCopyShare, copyShareNote, type ClassMessage } from "./format";
import { copyText, openMedia, shareMessage } from "./media";

export default function MessageActions({ m, at, restricted, onClose, onSend, onSelect }: { m: ClassMessage | null; at: number; restricted: boolean; onClose: () => void; onSend?: () => void; onSelect?: () => void }) {
  const { toast } = useFeedback(); const [busy, setBusy] = useState("");
  const attempt = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { toast(friendly(e), "bad"); } finally { setBusy(""); } };
  // Checked again at the moment of the tap: the sheet may have been open while the window ran out.
  const refused = (now: number) => { if (m && !canCopyShare(m, now, restricted)) { onClose(); toast("Copy and share closed 2 hours after this message arrived.", "bad"); return true; } return false; };

  const copy = () => { if (!m || refused(now())) return; return attempt("copy", async () => { await copyText(m.body ?? ""); toast("Copied"); onClose(); }); };
  const share = () => { if (!m || refused(now())) return; return attempt("share", async () => { const r = await shareMessage(m); if (r === "copied") toast("Copied. Paste it anywhere."); onClose(); }); };
  const save = () => { if (m) attempt("save", async () => { await openMedia(m); toast("Download started"); onClose(); }); };

  const open = !!m; const can = !!m && canCopyShare(m, at, restricted);
  return (
    <Sheet open={open} onClose={onClose}>
      {m ? (
        <View style={{ gap: 8 }}>
          {m.body ? <Text size={14} tone="muted" numberOfLines={3} style={{ marginBottom: 8 }}>{m.body}</Text> : null}
          {can && m.body ? <Button variant="secondary" loading={busy === "copy"} onPress={copy}>Copy text</Button> : null}
          {can ? <Button variant="secondary" loading={busy === "share"} onPress={share}>Share</Button> : null}
          {m.media_path ? <Button variant="secondary" loading={busy === "save"} onPress={save}>Save file</Button> : null}
          {onSend ? <Button onPress={() => { onClose(); onSend(); }}>Send to other chats</Button> : null}
          {onSelect ? <Button variant="secondary" onPress={() => { onClose(); onSelect(); }}>Select more messages</Button> : null}
          {restricted ? <Text size={12} tone="muted" align="center" style={{ paddingTop: 4 }}>{can ? copyShareNote(m) : "Copy and share closed 2 hours after this message arrived."}</Text> : null}
        </View>) : null}
    </Sheet>
  );
}
