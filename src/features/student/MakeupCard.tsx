// src/features/student/MakeupCard.tsx
// Port of web components/MakeupCard.tsx: free make-up classes. Once a student's time is up they get two months and up to six classes to catch up on
// anything they missed. The numbers come from my_makeup_status(), so the rules live in one place (the database).
import { View } from "react-native";
import { useRpc } from "@/data";
import { fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Card, Icon, Section, Text } from "@/ui";

type Lesson = { course: string; lesson_no: number; title: string };
type Status = { enrolment_id: string; state: "pending" | "before" | "open" | "closed"; closes_at: string | null; missed: number; used: number; allowance: number; slots_left: number; lessons: Lesson[] };
const day = (iso: string) => fmtWhen(iso, { day: "numeric", month: "long" });

export default function MakeupCard() {
  const { p } = useTheme();
  const q = useRpc<Status[]>("my_makeup_status", {}, { tags: ["attendance", "sessions", "enrolments"], ttlMs: 2 * 60_000 });
  const shown = (q.data ?? []).filter((r) => r.missed > 0 || (r.state === "open" && r.used > 0));
  if (shown.length === 0) return null;
  return (
    <Section title="Make-up classes">
      {shown.map((r) => {
        const left = Math.min(r.slots_left, r.missed);
        return (
          <Card key={r.enrolment_id} style={{ gap: 8 }}>
            {r.state === "open" && <>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text weight="medium" style={{ flex: 1 }}>{left > 0 ? `${left} make-up ${left === 1 ? "class" : "classes"} left` : r.missed > 0 ? "No make-up classes left" : "All caught up"}</Text>
                {!!r.closes_at && <Badge tone="info">{`until ${day(r.closes_at)}`}</Badge>}
              </View>
              <Text size={14} tone="muted">
                {r.missed > r.allowance - r.used && r.missed > 0
                  ? `You missed ${r.missed + r.used} classes. You can make up ${r.allowance} of them, free, before ${r.closes_at ? day(r.closes_at) : "the window closes"}.`
                  : `Attend the classes you missed, free, before ${r.closes_at ? day(r.closes_at) : "the window closes"}.`}
                {r.used > 0 ? ` You've made up ${r.used} so far.` : ""}
              </Text>
            </>}
            {r.state === "closed" && <>
              <Text weight="medium">Make-up window closed</Text>
              <Text size={14} tone="muted">{`You missed ${r.missed} ${r.missed === 1 ? "class" : "classes"} that weren't made up. You can still take the course again below.`}</Text>
            </>}
            {(r.state === "before" || r.state === "pending") && <>
              <Text weight="medium">{`You've missed ${r.missed} ${r.missed === 1 ? "class" : "classes"} so far`}</Text>
              <Text size={14} tone="muted">When your classes end you get two months to make up to six of them, free. Keep attending the rest.</Text>
            </>}
            {r.lessons.length > 0 && r.state !== "before" && r.state !== "pending" && (
              <View style={{ gap: 4, paddingTop: 4 }}>
                {r.lessons.map((l) => (
                  <View key={`${l.course}-${l.lesson_no}`} style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ marginTop: 2 }}><Icon name="close" size={16} color={p.c.bad} /></View>
                    <Text size={14} style={{ flex: 1 }}><Text size={14} tone="muted">{l.course} · </Text>{l.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </Section>
  );
}
