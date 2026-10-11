// Port of web pages/InstructorHome.tsx. Home for instructors: the next class (countdown), this month's numbers, today's classes and the week ahead.
// Cached, so it opens offline; refreshed when classes or attendance change.
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { useRpc } from "@/data";
import ClassCountdown from "@/features/student/ClassCountdown";
import RunReminder from "@/features/staff/RunReminder";
import { fmtClock, fmtWhen } from "@/shared/web/time";
import { Badge, Card, Empty, PageHeader, Place, Section, Skeleton, Stat, Text } from "@/ui";

type S = { id: string; start_at: string; end_at: string; status?: string; centre_name: string; centre_city?: string | null; centre_address?: string | null; course_title: string; students_present?: number; students_enrolled?: number };
type D = { today?: S[]; upcoming?: S[]; sessions_taught?: number; student_attendances?: number; unique_students?: number; avg_students_per_class?: number; lifetime?: { sessions_taught?: number } };

export function InstructorHome() {
  const { name } = useAuth(); const router = useRouter();
  const q = useRpc<D>("instructor_dashboard", {}, { tags: ["sessions", "attendance"], ttlMs: 60_000 });
  const d = q.data ?? (q.error ? {} : undefined);
  if (!d) return <View style={{ gap: 16 }}><Skeleton height={32} style={{ width: "66%" }} /><Skeleton height={96} /><Skeleton height={128} /></View>;
  const today = d.today ?? [], up = d.upcoming ?? [];
  const where = (s: S) => ({ name: s.centre_name, city: s.centre_city, address: s.centre_address });
  return (
    <View style={{ gap: 24 }}>
      <PageHeader title={`Hi ${name.split(" ")[0]}`} />
      <RunReminder />
      <ClassCountdown />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><Stat tone="info" label="Classes this month" value={d.sessions_taught ?? 0} sub={`${d.lifetime?.sessions_taught ?? 0} all time`} /></View>
        <View style={{ flex: 1 }}><Stat tone="ok" label="Students taught" value={d.student_attendances ?? 0} sub={`${d.unique_students ?? 0} different people · avg ${d.avg_students_per_class ?? 0} per class`} /></View>
      </View>
      <Section title="Today">
        {today.length === 0 ? <Empty icon="today" title="No classes today" hint="Enjoy the break." /> : today.map((s) => (
          <Card key={s.id} onPress={() => router.push(`/class/${s.id}`)} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <Text weight="medium" style={{ flex: 1 }}>{s.course_title}</Text>
              <Badge tone={s.status === "completed" ? "ok" : s.status === "in_progress" ? "info" : "muted"}>{s.status === "in_progress" ? "Live" : s.status === "completed" ? "Done" : "Scheduled"}</Badge>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}><Text size={14} tone="muted">{`${fmtClock(s.start_at)} – ${fmtClock(s.end_at)} · `}</Text><Place centre={where(s)} nameOnly size={14} tone="muted" /></View>
            {s.status === "completed" && <Text size={14} num>{s.students_present} of {s.students_enrolled} students attended</Text>}
          </Card>))}
      </Section>
      <Section title="Coming up">
        {up.length === 0 ? <Empty icon="schedule" title="Nothing in the next 7 days" /> : up.map((s) => (
          <Card key={s.id} style={{ gap: 2 }}>
            <Text weight="medium">{s.course_title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}><Text size={14} tone="muted">{`${fmtWhen(s.start_at, { weekday: "short", day: "numeric", month: "short" })} · ${fmtClock(s.start_at)} · `}</Text><Place centre={where(s)} nameOnly size={14} tone="muted" /></View>
            {s.centre_address ? <Text size={12} tone="muted">{s.centre_address}</Text> : null}
          </Card>))}
      </Section>
    </View>
  );
}
