// One class channel in a list: course, when it ran, the latest message, and (for students) how many are unread. Port of web components/ChannelRow.tsx.
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { channelDate, channelPreview, channelWhen, type Channel } from "@/shared/web/channels";
import { dayOf, fmtClock, today } from "@/shared/web/time";
import { Badge, Card, Text } from "@/ui";

export default function ChannelRow({ c, instructor }: { c: Channel; instructor?: boolean }) {
  const router = useRouter();
  const live = c.status === "in_progress";
  const closed = !instructor && !!c.locked; // the cohort has ended: the student still sees the channel, but not what is in it
  const stamp = !closed && c.last_message_at ? (dayOf(c.last_message_at) === today() ? fmtClock(c.last_message_at) : channelWhen(c.last_message_at)) : "";
  const preview = closed ? "Your cohort has ended" : instructor ? channelPreview(c) : c.instructor_first_name ? `Instructor ${c.instructor_first_name}: ${channelPreview(c)}` : channelPreview(c);
  return (
    <Card onPress={() => router.navigate(`/messages/${c.session_id}` as Href)} style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="semibold" numberOfLines={1}>{c.course_title}</Text>
          <Text size={14} tone="muted" numberOfLines={1}>{[c.lesson_title, channelDate(c)].filter(Boolean).join(" · ")}</Text>
        </View>
        {closed ? <Badge tone="muted">Closed</Badge> : live ? <Badge tone="ok">Live</Badge> : c.unread ? <Badge tone="accent">{`${c.unread} new`}</Badge> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text size={14} weight={c.unread && !closed ? "medium" : "regular"} tone={c.unread && !closed ? "ink" : "muted"} numberOfLines={1} style={{ flex: 1 }}>{preview}</Text>
        <Text size={12} tone="muted">{`${instructor && c.joined !== undefined ? `${c.joined} joined${stamp ? " · " : ""}` : ""}${stamp}`}</Text>
      </View>
    </Card>
  );
}
