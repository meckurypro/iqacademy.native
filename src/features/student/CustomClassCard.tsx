// src/features/student/CustomClassCard.tsx
// Port of web components/CustomClassCard.tsx @d14323f: a custom class the student was invited to by an instructor (any centre, no automatic eligibility).
// The countdown card already shows the very next class, so this skips that one. "Check in" opens the same code sheet as a normal class.
// Invitations, changes and withdrawals arrive as notifications, and the shared realtime channel refreshes the "notifications" tag, so this updates by itself.
import { View } from "react-native";
import { useRpc } from "@/data";
import { CHECKIN_OPENS_MIN } from "@/shared/checkin";
import { fmtClock, fmtWhen } from "@/shared/web/time";
import { Badge, Button, Card, Place, Text } from "@/ui";
import { useClassClock } from "./hooks";

type E = {
  id: string; start_at: string; end_at: string; status: string; course_title: string; lesson_title: string | null;
  centre_name: string; centre_city: string | null; centre_address: string | null; instructor_first_name: string | null; note: string | null; checked_in: boolean;
};

export default function CustomClassCard({ onCheckIn }: { onCheckIn: () => void }) {
  const { current, loading, now } = useClassClock(3, true);
  const q = useRpc<E[]>("custom_classes_for_me", {}, { tags: ["notifications", "sessions", "attendance"], ttlMs: 60_000 });
  const shown = (q.data ?? []).filter((s) => s.id !== current?.id);
  if (loading || shown.length === 0) return null;
  return (
    <>
      {shown.map((s) => {
        const canCheckIn = now >= Date.parse(s.start_at) - CHECKIN_OPENS_MIN * 60000 && !s.checked_in;
        return (
          <Card key={s.id} variant="glass" style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text size={14} weight="semibold" tone="info">Custom class</Text>
              {s.checked_in ? <Badge tone="ok">{"You're in"}</Badge> : <Badge tone={s.status === "in_progress" ? "info" : "muted"}>{s.status === "in_progress" ? "Live" : "Coming up"}</Badge>}
            </View>
            <View>
              <Text size={18} weight="semibold">{s.course_title}</Text>
              {!!s.lesson_title && <Text size={14} tone="muted">{s.lesson_title}</Text>}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
              <Text size={14} tone="muted">{fmtWhen(s.start_at, { weekday: "short", day: "numeric", month: "short" })} · {fmtClock(s.start_at)} – {fmtClock(s.end_at)} · </Text>
              <Place centre={{ name: s.centre_name, city: s.centre_city, address: s.centre_address }} size={14} tone="muted" />
            </View>
            {!!s.note && <Text size={14}>{s.note}</Text>}
            {canCheckIn && <Button onPress={onCheckIn} style={{ height: 48 }}>Check in</Button>}
            {!s.checked_in && !canCheckIn && <Text size={14} tone="muted">{`Check-in opens ${CHECKIN_OPENS_MIN} minutes before the start. Your instructor or the centre will show the class code.`}</Text>}
          </Card>
        );
      })}
    </>
  );
}
