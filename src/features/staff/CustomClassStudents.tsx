// Port of web components/CustomClassStudents.tsx. Choosing who is invited to a custom class.
// Nobody is added for the instructor: eligibility is an explicit invitation, never "everyone at the centre" and never automatic. The instructor finds
// students by name, or adds a group (a centre, a course, or a course run, in any mix). Every student chosen stays listed so they can be taken off again.
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { friendly } from "@/core/errors";
import { useRpc } from "@/data";
import { useDebounced } from "@/shared/useDebounced";
import { placeLabel } from "@/shared/web/centre";
import { fmtDay } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Icon, SearchField, SelectSheet, Text } from "@/ui";

export type Student = { id: string; name: string; centre: string | null; /** already checked in: can't be taken off */ locked?: boolean };
type Found = { student_id: string; full_name: string | null; centre_name: string | null; courses: string | null };
type Centre = { id: string; name: string; city: string | null; address: string | null };
type Course = { id: string; title: string };
type Run = { id: string; centre_name: string; course_title: string; start_date: string; end_date: string };

const toStudent = (f: Found): Student => ({ id: f.student_id, name: f.full_name?.trim() || "Student", centre: f.centre_name });
const dayRange = (r: Run) => `${fmtDay(r.start_date, { day: "numeric", month: "short" })} – ${fmtDay(r.end_date, { day: "numeric", month: "short" })}`;
const ANY = "";

export default function CustomClassStudents({ selected, onAdd, onRemove, centres, courses }: { selected: Student[]; onAdd: (s: Student[]) => void; onRemove: (id: string) => void; centres: Centre[]; courses: Course[] }) {
  const { p } = useTheme();
  const ids = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const [q, setQ] = useState(""); const term = useDebounced(q.trim(), 300); const typing = q.trim().length >= 2;
  const sq = useRpc<Found[]>("search_students_for_custom_class", { p_query: term, p_centre_id: null, p_course_id: null, p_run_id: null, p_limit: 30 }, { enabled: term.length >= 2, ttlMs: 20_000 });
  const settled = term === q.trim();

  const [groupOpen, setGroupOpen] = useState(false); const [gCentre, setGCentre] = useState(ANY); const [gCourse, setGCourse] = useState(ANY); const [gRun, setGRun] = useState(ANY);
  const rq = useRpc<Run[]>("custom_class_runs", { p_centre_id: gCentre || null, p_course_id: gCourse || null }, { enabled: groupOpen && !!(gCentre || gCourse), ttlMs: 60_000 });
  const runs = gCentre || gCourse ? rq.data ?? [] : [];
  const gq = useRpc<Found[]>("search_students_for_custom_class", { p_query: null, p_centre_id: gCentre || null, p_course_id: gCourse || null, p_run_id: gRun || null, p_limit: 500 }, { enabled: groupOpen && !!(gCentre || gCourse || gRun), ttlMs: 20_000 });
  const group = gCentre || gCourse || gRun ? gq.data : undefined;
  const fresh = (group ?? []).filter((f) => !ids.has(f.student_id));

  const box = { borderRadius: 12, borderWidth: 1, borderColor: p.c.line, overflow: "hidden" as const };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><Text size={14} tone="muted">Students</Text><Text size={14} tone="muted" num>{selected.length} invited</Text></View>
      <SearchField label="Search students by name" value={q} onChangeText={setQ} placeholder="Search students by name" autoCapitalize="none" />
      {typing && (
        <View style={box}>
          {!settled || sq.loading ? <Text size={14} tone="muted" style={{ padding: 14 }}>Searching…</Text>
            : sq.error ? <Text size={14} tone="bad" style={{ padding: 14 }}>{"Couldn't search. Try again."}</Text>
            : (sq.data ?? []).length === 0 ? <Text size={14} tone="muted" style={{ padding: 14 }}>No students found.</Text>
            : <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">{(sq.data ?? []).map((f, i) => {
              const on = ids.has(f.student_id);
              return (
                <Pressable key={f.student_id} accessibilityRole="button" disabled={on} onPress={() => onAdd([toStudent(f)])} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: p.c.line, opacity: on ? 0.6 : 1 }}>
                  <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{f.full_name?.trim() || "Student"}</Text><Text size={14} tone="muted" numberOfLines={1}>{[f.centre_name, f.courses].filter(Boolean).join(" · ")}</Text></View>
                  {on ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="check" size={16} color={p.c.accent} /><Text size={14} weight="medium" tone="accent">Added</Text></View> : <Text size={14} weight="medium" tone="accent">Add</Text>}
                </Pressable>);
            })}</ScrollView>}
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={() => setGroupOpen((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44 }}>
        <Text size={14} weight="medium" tone="accent">Add a group</Text><Icon name={groupOpen ? "chevronUp" : "chevronDown"} size={16} color={p.c.accent} />
      </Pressable>
      {groupOpen && (
        <View style={{ gap: 10, borderRadius: 12, backgroundColor: p.a("sunken", 0.6), borderWidth: 1, borderColor: p.c.line, padding: 12 }}>
          <SelectSheet label="Centre" value={gCentre} placeholder="Any centre" options={[{ value: ANY, label: "Any centre" }, ...centres.map((c) => ({ value: c.id, label: placeLabel(c) }))]} onChange={(v) => { setGCentre(v); setGRun(ANY); }} />
          <SelectSheet label="Course" value={gCourse} placeholder="Any course" options={[{ value: ANY, label: "Any course" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} onChange={(v) => { setGCourse(v); setGRun(ANY); }} />
          {(gCentre || gCourse) && runs.length > 0 && <SelectSheet label="Course run" value={gRun} placeholder="Any run" options={[{ value: ANY, label: "Any run" }, ...runs.map((r) => ({ value: r.id, label: `${r.course_title} · ${r.centre_name} · ${dayRange(r)}` }))]} onChange={setGRun} />}
          {!gCentre && !gCourse ? <Text size={14} tone="muted">Choose a centre or a course to see who is in it.</Text>
            : gq.error ? <Text size={14} tone="bad">{friendly(gq.error) || "Couldn't load that group. Try again."}</Text>
            : group === undefined ? <Text size={14} tone="muted">Finding students…</Text>
            : group.length === 0 ? <Text size={14} tone="muted">No active students match.</Text>
            : <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text size={14} tone="muted" num style={{ flex: 1 }}>{group.length} {group.length === 1 ? "student" : "students"}{fresh.length < group.length ? `, ${fresh.length} not added yet` : ""}{group.length >= 500 ? " (first 500)" : ""}</Text>
              <Button style={{ height: 40, paddingHorizontal: 16 }} disabled={fresh.length === 0} onPress={() => onAdd(fresh.map(toStudent))}>{`Add ${fresh.length === group.length ? "all" : fresh.length}`}</Button>
            </View>}
        </View>
      )}

      {selected.length === 0 ? <Text size={14} tone="muted">No one yet. Search for a student or add a group.</Text>
        : <ScrollView style={{ maxHeight: 288, ...box }} nestedScrollEnabled>{selected.map((s, i) => (
          <View key={s.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: p.c.line }}>
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{s.name}</Text>{s.centre ? <Text size={14} tone="muted" numberOfLines={1}>{s.centre}</Text> : null}</View>
            {s.locked ? <Text size={14} tone="muted">Checked in</Text>
              : <Pressable accessibilityLabel={`Remove ${s.name}`} onPress={() => onRemove(s.id)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} color={p.c.muted} /></Pressable>}
          </View>))}</ScrollView>}
    </View>
  );
}
