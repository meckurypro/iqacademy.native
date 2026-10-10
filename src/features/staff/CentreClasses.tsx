// Port of web pages/CentreClasses.tsx. Who teaches what, and when, at the centre. Read-only: scheduling and staffing stay with IQ Academy.
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { friendly, ok } from "@/core/errors";
import { useQuery } from "@/data";
import { useTicker } from "@/shared/useTicker";
import { place } from "@/shared/web/centre";
import { addDays, fmtClock, fmtWhen, now, today } from "@/shared/web/time";
import { Avatar, Badge, Empty, Err, List, PageHeader, Section, Skeleton, Text } from "@/ui";
import { BranchChips, useEachRpc } from "./common";
import { useStaffCentres } from "./useStaffCentres";

type Cls = { id: string; centre_id: string; start_at: string; end_at: string; status: string; session_date: string; course_title: string; lesson_title: string | null; instructor_id: string | null; instructor_name: string | null; students_enrolled: number | null; students_present: number | null; is_emergency: boolean };
type Member = { user_id: string; role: string; full_name: string; avatar_url: string | null };
const STATUS: Record<string, { label: string; tone: "ok" | "info" | "bad" | "muted" }> = {
  scheduled: { label: "Scheduled", tone: "muted" }, in_progress: { label: "Live", tone: "info" }, completed: { label: "Held", tone: "ok" }, cancelled: { label: "Cancelled", tone: "bad" },
};
const dayLabel = (iso: string) => fmtWhen(iso, { weekday: "short", day: "numeric", month: "short" });
const PAST_SHOWN = 5;

export default function CentreClasses() {
  const { shown, centres, sel, setSel, ids } = useStaffCentres();
  const [allPast, setAllPast] = useState(false); useTicker(60_000); // "coming up" vs "last two weeks" is decided by the clock
  const from = addDays(today(), -14), to = addDays(today(), 21);
  const cq = useQuery<Cls[]>({
    key: ["centreClasses", shown, from, to], enabled: shown.length > 0, tags: ["sessions"], ttlMs: 60_000,
    fn: async (sb) => (ok(await sb.from("v_session_details")
      .select("id,centre_id,start_at,end_at,status,session_date,course_title,lesson_title,instructor_id,instructor_name,students_enrolled,students_present,is_emergency")
      .in("centre_id", shown).gte("session_date", from).lte("session_date", to).order("start_at")) as Cls[]) ?? [],
  });
  const tq = useEachRpc<Member[]>("centre_team", shown, ["team"]);
  const classes = useMemo(() => (shown.length ? cq.data : []), [shown.length, cq.data]); const team = tq.data?.flatMap((r) => r.data ?? []);
  const err = cq.error ? friendly(cq.error) : "";

  const instructors = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number }>();
    (classes ?? []).filter((c) => c.instructor_id && c.status !== "cancelled").forEach((c) => { const x = m.get(c.instructor_id!) ?? { id: c.instructor_id!, name: c.instructor_name ?? "Instructor", n: 0 }; x.n++; m.set(c.instructor_id!, x); });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);
  const t = now();
  const coming = (classes ?? []).filter((c) => new Date(c.end_at).getTime() >= t && c.status !== "cancelled");
  const past = (classes ?? []).filter((c) => new Date(c.end_at).getTime() < t || c.status === "cancelled").reverse();
  const centreName = (id: string) => { const c = centres?.find((x) => x.id === id); return c ? place(c) : ""; };

  const row = (c: Cls) => {
    const s = STATUS[c.status] ?? { label: c.status, tone: "muted" as const };
    const count = c.status === "completed" ? `${c.students_present} of ${c.students_enrolled} present` : c.status === "scheduled" ? `${c.students_enrolled} expected` : "";
    return (
      <View key={c.id} style={{ gap: 2, paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{c.course_title}{c.is_emergency ? " · custom" : ""}</Text><Badge tone={s.tone}>{s.label}</Badge>
        </View>
        <Text size={13} tone="muted" numberOfLines={1}>{c.lesson_title ?? "Class"}</Text>
        <Text size={13}>{dayLabel(c.start_at)} · {fmtClock(c.start_at)} to {fmtClock(c.end_at)}{ids.length > 1 && sel === "all" ? ` · ${centreName(c.centre_id)}` : ""}</Text>
        <Text size={13} tone="muted">{c.instructor_name ?? "Instructor to be assigned"}{count ? ` · ${count}` : ""}</Text>
      </View>);
  };

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Classes & staff" sub="Who teaches what at your centre" />
      {ids.length > 1 && <BranchChips centres={centres} sel={sel} setSel={setSel} />}
      <Err>{err}</Err>
      {centres === undefined || !classes || !team ? <View style={{ gap: 12 }}><Skeleton height={64} /><Skeleton height={160} /></View> : <>
        <Section title="Staff on site">
          {instructors.length === 0 && team.length === 0 ? <Empty icon="instructor" title="No staff listed yet." /> : <List>
            {instructors.map((i) => (
              <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Avatar name={i.name} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{i.name}</Text><Text size={12} tone="muted">{i.n} {i.n === 1 ? "class" : "classes"} in this window</Text></View>
                <Badge tone="info">Instructor</Badge>
              </View>))}
            {team.map((m) => (
              <View key={m.user_id + m.role} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Avatar name={m.full_name} url={m.avatar_url} size={32} />
                <Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>{m.full_name}</Text>
                <Badge tone={m.role === "centre_director" ? "ok" : "muted"}>{m.role === "centre_director" ? "Director" : "Coordinator"}</Badge>
              </View>))}
          </List>}
        </Section>
        <Section title="Coming up" aside={<Text size={14} tone="muted" num>{coming.length}</Text>}>
          {coming.length === 0 ? <Empty icon="classes" title="No classes scheduled in the next three weeks." /> : <List>{coming.map(row)}</List>}
        </Section>
        <Section title="Last two weeks" aside={<Text size={14} tone="muted" num>{past.length}</Text>}>
          {past.length === 0 ? <Text size={14} tone="muted">Nothing yet.</Text> : <>
            <List>{(allPast ? past : past.slice(0, PAST_SHOWN)).map(row)}</List>
            {past.length > PAST_SHOWN && <Pressable accessibilityRole="button" onPress={() => setAllPast(!allPast)} style={{ paddingVertical: 8 }}><Text size={14} weight="medium" tone="accent" align="center">{allPast ? "Show fewer" : `Show all ${past.length}`}</Text></Pressable>}
          </>}
        </Section>
      </>}
    </View>
  );
}
