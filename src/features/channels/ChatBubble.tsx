// One message in a class channel, drawn like a chat app (port of web components/ChatBubble.tsx): compact bubble, time in the corner, sender shown once per run.
// Students can select the text for two hours after it arrives; after that it cannot be selected. Attachments download only on a tap.
// Not yet: copy / share actions, selecting messages to send on to other classes (instructor).
import { useState } from "react";
import { Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { friendly } from "@/core/errors";
import { online } from "@/data";
import { fmtClock } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, Text, useFeedback } from "@/ui";
import { BUCKET, copyShareClosed, fileSize, isImageMime, type ClassMessage } from "./format";

export default function ChatBubble({ m, out, first, showName, restricted, at }: { m: ClassMessage; out?: boolean; first?: boolean; showName?: boolean; restricted?: boolean; at: number }) {
  const { p } = useTheme(); const { toast } = useFeedback(); const [busy, setBusy] = useState(false);
  const closed = !!restricted && copyShareClosed(m, at);
  const save = async () => {
    if (!m.media_path || busy) return; setBusy(true);
    try {
      const url = await online(async (sb) => { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(m.media_path!, 120, { download: m.media_name ?? true }); if (error || !data?.signedUrl) throw error ?? new Error("download_failed"); return data.signedUrl; });
      await WebBrowser.openBrowserAsync(url);
    } catch (e) { toast(friendly(e), "bad"); } finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: first ? 12 : 2, alignItems: out ? "flex-end" : "flex-start" }}>
      <View style={{ maxWidth: "84%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: out ? p.a("accent", 0.15) : p.c.surface, ...(first ? (out ? { borderTopRightRadius: 6 } : { borderTopLeftRadius: 6 }) : {}) }}>
        {showName ? <Text size={12.5} weight="semibold" tone="accent" style={{ marginBottom: 2 }}>{m.sender_label}</Text> : null}
        {m.media_path ? (
          <Pressable onPress={save} disabled={busy} accessibilityRole="button" accessibilityLabel={`Download ${m.media_name ?? "file"}`}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minWidth: 190, padding: 8, marginBottom: 6, borderRadius: 12, backgroundColor: p.c.sunken, opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}>
            <View style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: p.c.surface }}><Icon name={isImageMime(m.media_mime) ? "image" : "file"} size={20} color={p.c.muted} /></View>
            <View style={{ flex: 1 }}><Text size={14} weight="medium" numberOfLines={1}>{m.media_name ?? "File"}</Text><Text size={12} tone="muted">{[fileSize(m.media_size), "Tap to download"].filter(Boolean).join(" · ")}</Text></View>
            <Icon name="download" size={18} color={p.c.accent} />
          </Pressable>) : null}
        {m.body ? <Text size={15} lh={21} selectable={!closed}>{m.body}</Text> : null}
        <Text size={11} tone="muted" num style={{ alignSelf: "flex-end", marginTop: 2 }}>{fmtClock(m.created_at)}</Text>
      </View>
    </View>
  );
}

/** A message that has not reached the server yet (offline, or retrying). */
export function PendingBubble({ body, status, onRetry, onDiscard }: { body: string | null; status: string; onRetry: () => void; onDiscard: () => void }) {
  const { p } = useTheme(); const dead = status === "dead";
  return (
    <View style={{ marginTop: 6, alignItems: "flex-end" }}>
      <View style={{ maxWidth: "84%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.a("accent", 0.08), borderWidth: 1, borderStyle: "dashed", borderColor: dead ? p.c.bad : p.c.line, gap: 4 }}>
        {body ? <Text size={15} lh={21}>{body}</Text> : null}
        <Text size={11} tone={dead ? "bad" : "muted"} style={{ alignSelf: "flex-end" }}>{dead ? "Not sent" : status === "failed" ? "Will retry…" : "Waiting to send…"}</Text>
        {dead ? <View style={{ flexDirection: "row", gap: 16, alignSelf: "flex-end" }}><Text size={13} weight="medium" tone="accent" onPress={onRetry}>Try again</Text><Text size={13} weight="medium" tone="muted" onPress={onDiscard}>Discard</Text></View> : null}
      </View>
    </View>
  );
}
