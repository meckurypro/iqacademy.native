// Port of web components/RunReminder.tsx. Admins and instructors are nudged when a course is about to hold its last class with nothing scheduled after it.
import { useRouter } from "expo-router";
import { ok } from "@/core/errors";
import { useQuery } from "@/data";
import { fmtDay } from "@/shared/web/time";
import { Card, Text } from "@/ui";

type R = { id: string; course_title: string; centre_city: string | null; centre_name: string; last_session_date: string | null };

export default function RunReminder() {
  const router = useRouter();
  const q = useQuery<R[]>({ key: ["runReminder"], tags: ["schedule", "sessions"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("v_course_runs").select("id,course_title,centre_city,centre_name,last_session_date").eq("ending_soon", true)) as R[]) ?? [] });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  const d = (iso: string | null) => (iso ? fmtDay(iso, { day: "numeric", month: "short" }) : "");
  return (
    <Card variant="glass" onPress={() => router.push("/schedule")} style={{ gap: 4 }}>
      <Text weight="medium">Set the next course dates</Text>
      <Text size={14} tone="muted">{rows.map((r) => `${r.course_title} at ${r.centre_city || r.centre_name} ends ${d(r.last_session_date)}`).join(" · ")}</Text>
    </Card>
  );
}
