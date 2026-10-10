// Port of web pages/Students.tsx. The centre's view of its students: who they are, what they are enrolled in, whether they are paid up and how often they attend.
// Contact details, birth dates, addresses and learning progress stay with IQ Academy; the database never sends them to the centre.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { naira } from "@/core/errors";
import { place } from "@/shared/web/centre";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Badge, Chip, ChipRow, Empty, Err, List, PageHeader, SearchField, Section, Skeleton, StatStrip, Text } from "@/ui";
import { BranchChips, useEachRpc } from "./common";
import { useStaffCentres } from "./useStaffCentres";

type Row = { enrolment_id: string; full_name: string | null; avatar_url: string | null; student_number: string | null; status: string; duration_weeks: number | null; pack: string | null; courses: string[] | null; attended: number; total_sessions: number; total_amount: number | null; balance: number; centre_id: string };
const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "info" }> = {
  active: { label: "Active", tone: "ok" }, pending_payment: { label: "Unpaid", tone: "warn" }, completed: { label: "Completed", tone: "info" },
};

export default function Students() {
  const { p } = useTheme();
  const { shown, centres, sel, setSel, ids, isDirector } = useStaffCentres();
  const [q, setQ] = useState(""); const [weeks, setWeeks] = useState(0); const [status, setStatus] = useState("all");
  const each = useEachRpc<Omit<Row, "centre_id">[]>("centre_students", shown, ["students", "enrolments"]);
  const loading = centres === undefined || each.data === undefined;
  const err = each.data?.find((r) => r.err)?.err ?? "";
  const rows = useMemo<Row[] | undefined>(() => each.data?.flatMap((r) => (r.data ?? []).map((x) => ({ ...x, centre_id: r.id }))), [each.data]);

  const name = (id: string) => { const c = centres?.find((x) => x.id === id); return c ? place(c) : ""; };
  const list = useMemo(() => (rows ?? []).filter((r) => {
    const t = q.trim().toLowerCase();
    return (!t || r.full_name?.toLowerCase().includes(t) || r.student_number?.toLowerCase().includes(t)) && (!weeks || r.duration_weeks === weeks) && (status === "all" || r.status === status);
  }), [rows, q, weeks, status]);
  const count = (f: (r: Row) => boolean) => (rows ?? []).filter(f).length;

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Students" sub="Everyone enrolled at your centre" />
      {ids.length > 1 && <BranchChips centres={centres} sel={sel} setSel={setSel} />}
      <Err>{err}</Err>
      {loading || !rows ? <View style={{ gap: 12 }}><Skeleton height={64} /><Skeleton height={160} /></View> : <>
        <StatStrip items={[
          { label: "Active", value: count((r) => r.status === "active"), tone: "ok" },
          { label: "Unpaid", value: count((r) => r.status === "pending_payment"), tone: "warn" },
          { label: "6 weeks", value: count((r) => r.duration_weeks === 6) },
          { label: "10 weeks", value: count((r) => r.duration_weeks === 10) },
        ]} />
        <SearchField label="Search students" value={q} onChangeText={setQ} placeholder="Search name or reg. number" />
        <ChipRow>
          {([[0, "All bundles"], [6, "6 weeks"], [10, "10 weeks"]] as const).map(([w, l]) => <Chip key={w} on={weeks === w} onPress={() => setWeeks(w)}>{l}</Chip>)}
          <View style={{ width: 4 }} />
          {([["all", "Any status"], ["active", "Active"], ["pending_payment", "Unpaid"], ["completed", "Completed"]] as const).map(([s, l]) => <Chip key={s} on={status === s} onPress={() => setStatus(s)}>{l}</Chip>)}
        </ChipRow>
        <Section title="Student list" aside={<Text size={14} tone="muted" num>{list.length}</Text>}>
          {list.length === 0 ? <Empty icon="users" title={rows.length ? "No one matches that." : "No students yet."} hint={rows.length ? undefined : "Students appear here when they register at your centre."} /> :
            <List>{list.map((r) => {
              const s = STATUS[r.status] ?? { label: r.status, tone: "info" as const };
              const pct = r.total_sessions ? Math.min(100, Math.round((r.attended / r.total_sessions) * 100)) : 0;
              return (
                <View key={r.enrolment_id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Avatar name={r.full_name ?? "?"} url={r.avatar_url} size={36} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Text weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{r.full_name}</Text><Badge tone={s.tone}>{s.label}</Badge>
                    </View>
                    <Text size={13} tone="muted" numberOfLines={1}>{r.student_number ?? "No number yet"}{r.duration_weeks ? ` · ${r.duration_weeks} wk` : ""}{r.pack ? ` · ${r.pack}` : ""}{ids.length > 1 && sel === "all" ? ` · ${name(r.centre_id)}` : ""}</Text>
                    {(r.courses ?? []).length > 0 && <Text size={12} tone="muted" numberOfLines={1}>{(r.courses ?? []).join(" · ")}</Text>}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 2 }}>
                      <View style={{ height: 6, width: 64, borderRadius: 3, backgroundColor: p.c.sunken, overflow: "hidden" }}><View style={{ height: 6, width: `${pct}%`, borderRadius: 3, backgroundColor: p.a("accent", 0.8) }} /></View>
                      <Text size={12} tone="muted" num>{r.attended}/{r.total_sessions} classes</Text>
                      {isDirector && r.total_amount != null && <Text size={12} tone="muted" num style={{ marginLeft: "auto" }}>{r.balance > 0 ? `${naira(r.balance)} left` : "Paid in full"}</Text>}
                    </View>
                  </View>
                </View>);
            })}</List>}
        </Section>
      </>}
    </View>
  );
}
