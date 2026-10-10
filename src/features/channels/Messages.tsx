// Port of web pages/Messages.tsx (a student's class channels, receive-only) and pages/InstructorMessages.tsx, chosen by role like web MessagesRoute.
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { useRealtime, useRpc } from "@/data";
import type { Channel } from "@/shared/web/channels";
import { Card, Empty, PageHeader, Skeleton, Text } from "@/ui";
import ChannelRow from "./ChannelRow";

const TAGS = ["messages", "sessions", "attendance"];

export default function MessagesRoute() {
  const { roles } = useAuth();
  return roles.some((r) => r.role === "instructor") ? <InstructorMessages /> : <StudentMessages />;
}

function StudentMessages() {
  const { session } = useAuth(); const uid = session?.user.id;
  const q = useRpc<Channel[]>("my_class_channels", {}, { tags: TAGS, ttlMs: 60_000, enabled: !!uid });
  useRealtime({ table: "class_messages", event: "DELETE", tags: ["messages"], enabled: !!uid });
  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Messages" />
      {!q.data ? <View style={{ gap: 12 }}><Skeleton height={80} /><Skeleton height={80} /></View>
        : q.data.length === 0 ? <Empty icon="messages" title="No class channels yet" hint="Check in to a class and its channel appears here." />
        : <View style={{ gap: 12 }}>{q.data.map((c) => <ChannelRow key={c.session_id} c={c} />)}</View>}
    </View>
  );
}

function InstructorMessages() {
  const router = useRouter(); const { session } = useAuth(); const uid = session?.user.id;
  const q = useRpc<Channel[]>("instructor_class_channels", {}, { tags: TAGS, ttlMs: 60_000, enabled: !!uid });
  useRealtime({ table: "class_messages", event: "DELETE", tags: ["messages"], enabled: !!uid });
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}><PageHeader title="Messages" /><Text size={14} tone="muted">{"A channel opens for each class when check-in opens, and stays open after the class ends. Students can't reply."}</Text></View>
      {!q.data ? <Skeleton height={96} />
        : q.data.length === 0 ? <Card style={{ gap: 4, alignItems: "center", paddingVertical: 24 }}><Text weight="medium">No class channels yet</Text>
            <Text size={14} tone="muted" align="center">{"A class's channel appears when its check-in opens, 30 minutes before it starts. You can follow arrivals from "}<Text size={14} weight="medium" tone="accent" onPress={() => router.navigate("/")}>Today</Text>.</Text></Card>
        : <View style={{ gap: 12 }}>{q.data.map((c) => <ChannelRow key={c.session_id} c={c} instructor />)}</View>}
    </View>
  );
}
