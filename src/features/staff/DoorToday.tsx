// Port of web components/DoorToday.tsx. Today's classes at the centre(s) a coordinator looks after, with a way into each class's check-in screen.
// The shared realtime channel refreshes it when a class changes ("sessions" tag).
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ok } from "@/core/errors";
import { useQuery } from "@/data";
import { doorState, opensAt } from "@/shared/checkin";
import { useTicker } from "@/shared/useTicker";
import { addDays, dayStart, fmtClock, now, today } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Card, Empty, Icon, Section, Skeleton, Text } from "@/ui";

type S = { id: string; centre_id: string; centre_name: string; start_at: string; end_at: string; course_title: string; instructor_name: string | null; status: string; students_present: number | null; students_enrolled: number | null; is_emergency: boolean };

export default function DoorToday({ centreIds, showCentre }: { centreIds: string[]; showCentre?: boolean }) {
  const { p } = useTheme(); const router = useRouter(); useTicker(30_000);
  const day = today(); const key = centreIds.join(",");
  const q = useQuery<S[]>({
    key: ["doorToday", key, day], enabled: centreIds.length > 0, tags: ["sessions"], ttlMs: 30_000,
    fn: async (sb) => (ok(await sb.from("v_session_details").select("id,centre_id,centre_name,start_at,end_at,course_title,instructor_name,status,students_present,students_enrolled,is_emergency")
      .in("centre_id", centreIds).gte("start_at", new Date(dayStart(day)).toISOString()).lt("start_at", new Date(dayStart(addDays(day, 1))).toISOString()).neq("status", "cancelled").order("start_at")) as S[]) ?? [],
  });
  const rows = centreIds.length ? q.data : [];
  const at = now();
  if (!rows) return <View style={{ gap: 12 }}><Skeleton height={80} /><Skeleton height={80} /></View>;
  return (
    <Section title="Classes today">
      {rows.length === 0 ? <Empty icon="today" title="No classes today" /> : rows.map((s) => {
        const st = s.status === "completed" ? "done" : doorState(s.start_at, s.end_at, at);
        return (
          <Card key={s.id} onPress={() => router.push(`/class/${s.id}`)} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text weight="medium" style={{ flexShrink: 1 }}>{s.course_title}{s.is_emergency ? <Text size={12} tone="info">{"  Custom"}</Text> : null}</Text>
              <Badge tone={s.status === "completed" ? "ok" : s.status === "in_progress" ? "info" : st === "open" ? "ok" : "muted"}>{s.status === "completed" ? "Done" : s.status === "in_progress" ? "Live" : st === "open" ? "Check-in open" : "Scheduled"}</Badge>
            </View>
            <Text size={14} tone="muted">{fmtClock(s.start_at)} – {fmtClock(s.end_at)}{showCentre ? ` · ${s.centre_name}` : ""}{s.instructor_name ? ` · ${s.instructor_name}` : ""}</Text>
            {s.status === "completed" ? <Text size={14} num>{s.students_present} of {s.students_enrolled} attended</Text>
              : st === "open" ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="scan" size={16} color={p.c.accent} /><Text size={14} weight="medium" tone="accent">Open the class code</Text></View>
              : st === "early" ? <Text size={14} tone="muted">Check-in opens at {opensAt(s.start_at)}</Text> : null}
          </Card>);
      })}
    </Section>
  );
}
