// Port of web components/MessageBubble.tsx @d14323f: one message as a card (not a chat bubble), for places that LIST messages rather than chat: an admin's view of a class,
// and the admin delete list (M10a passes `footer`). Files download only on a tap, through a short-lived link.
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { friendly } from "@/core/errors";
import { online } from "@/data";
import { fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, Text, useFeedback } from "@/ui";
import { BUCKET, fileSize, isImageMime, type ClassMessage } from "./format";

export default function MessageBubble({ m, footer }: { m: ClassMessage; footer?: ReactNode }) {
  const { p } = useTheme(); const { toast } = useFeedback(); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!m.media_path || busy) return; setBusy(true);
    try {
      const url = await online(async (sb) => { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(m.media_path!, 120, { download: m.media_name ?? true }); if (error || !data?.signedUrl) throw error ?? new Error("download_failed"); return data.signedUrl; });
      await WebBrowser.openBrowserAsync(url);
    } catch (e) { toast(friendly(e), "bad"); } finally { setBusy(false); }
  };
  return (
    <View style={{ borderRadius: 16, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text size={13} weight="semibold" tone="accent" numberOfLines={1} style={{ flexShrink: 1 }}>{m.sender_label}</Text>
        <Text size={12} tone="muted" num>{fmtWhen(m.created_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>
      </View>
      {m.media_path ? (
        <Pressable onPress={save} disabled={busy} accessibilityRole="button" accessibilityLabel={`Download ${m.media_name ?? "file"}`}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 12, backgroundColor: p.c.sunken, opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}>
          <View style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: p.c.surface }}><Icon name={isImageMime(m.media_mime) ? "image" : "file"} size={20} color={p.c.muted} /></View>
          <View style={{ flex: 1 }}><Text size={14} weight="medium" numberOfLines={1}>{m.media_name ?? "File"}</Text><Text size={12} tone="muted">{[fileSize(m.media_size), "Tap to download"].filter(Boolean).join(" · ")}</Text></View>
          <Icon name="download" size={18} color={p.c.accent} />
        </Pressable>) : null}
      {m.body ? <Text size={15} lh={22} selectable>{m.body}</Text> : null}
      {footer}
    </View>
  );
}
