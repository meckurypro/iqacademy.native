// Port of web components/CustomClassSheet.tsx. Create or edit a custom class: centre, course, topic and time come from pickers, and the instructor chooses
// who is invited (see CustomClassStudents). An instructor teaches the class themselves; an admin also picks which instructor does.
// Editing changes the details and the invitations together, in one save. Online-only: the server decides who may be invited and when edits lock.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { ok } from "@/core/errors";
import { mutate, useQuery, useRpc } from "@/data";
import { placeLabel } from "@/shared/web/centre";
import { fromWallInput, now, toWallInput } from "@/shared/web/time";
import { Button, DateTimeField, Err, Field, SelectSheet, Sheet, Text, useFeedback } from "@/ui";
import CustomClassStudents, { type Student } from "./CustomClassStudents";

export type CustomClassRow = {
  id: string; start_at: string; end_at: string; status: string; course_id: string; course_title: string; lesson_id: string | null; lesson_title: string | null;
  centre_id: string; centre_name: string; centre_city: string | null; centre_address: string | null; instructor_id: string | null; instructor_name: string | null;
  notes: string | null; students_invited: number; students_present: number; can_edit: boolean;
};
type Centre = { id: string; name: string; city: string | null; address: string | null };
type Course = { id: string; title: string };
type Lesson = { id: string; lesson_no: number; title: string };
type Person = { id: string; name: string };
type Invited = { student_id: string; full_name: string | null; centre_name: string | null; status: string | null };

const LENGTHS: [number, string][] = [[60, "1 hour"], [90, "1½ hours"], [120, "2 hours"], [180, "3 hours"]];
/** The next 5-minute mark at least a minute away, as a moment. */
const nextFive = () => Math.ceil((now() + 60000) / 300000) * 300000;
const byName = (a: Student, b: Student) => a.name.localeCompare(b.name);

export default function CustomClassSheet({ admin, edit, onClose, onSaved }: { admin: boolean; edit?: CustomClassRow; onClose: () => void; onSaved: () => void }) {
  const { run, toast } = useFeedback();
  const [centre, setCentre] = useState(edit?.centre_id ?? ""); const [course, setCourse] = useState(edit?.course_id ?? ""); const [lesson, setLesson] = useState(edit?.lesson_id ?? "");
  const [who, setWho] = useState("");
  const [start, setStart] = useState(() => toWallInput(edit ? Date.parse(edit.start_at) : nextFive()));
  const [minutes, setMinutes] = useState(() => (edit ? Math.round((Date.parse(edit.end_at) - Date.parse(edit.start_at)) / 60000) : 120));
  const [note, setNote] = useState(edit?.notes ?? ""); const [err, setErr] = useState("");
  const [added, setAdded] = useState<Student[]>([]); const [removed, setRemoved] = useState<Set<string>>(new Set());

  const cq = useQuery<Centre[]>({ key: ["ccCentres"], tags: ["centres"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("centres").select("id,name,city,address").eq("is_active", true).order("city")) as Centre[]) ?? [] });
  const kq = useQuery<Course[]>({ key: ["ccCourses"], tags: ["courses"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("courses").select("id,title").eq("is_active", true).order("sort_order")) as Course[]) ?? [] });
  const pq = useQuery<Person[]>({
    key: ["ccInstructors"], enabled: admin && !edit, tags: ["roles"], ttlMs: 5 * 60_000,
    fn: async (sb) => ((ok(await sb.from("user_roles").select("user_id,profiles!user_roles_user_id_fkey(full_name)").eq("role", "instructor").eq("is_active", true)) as any[]) ?? []).map((r) => ({ id: r.user_id as string, name: (r.profiles?.full_name as string) || "Instructor" })).sort((a, b) => a.name.localeCompare(b.name)),
  });
  const lq = useQuery<Lesson[]>({ key: ["ccLessons", course], enabled: !!course, tags: ["courses"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("course_lessons").select("id,lesson_no,title").eq("course_id", course).order("lesson_no")) as Lesson[]) ?? [] });
  const iq = useRpc<Invited[]>("custom_class_students", { p_session_id: edit?.id }, { enabled: !!edit, ttlMs: 0, tags: ["sessions"] });
  const centres = cq.data; const courses = kq.data ?? []; const people = pq.data ?? []; const lessons = course ? lq.data ?? [] : [];
  const loadErr = cq.error || kq.error || pq.error ? "Couldn't load the lists. Close this and try again." : iq.error ? "Couldn't load the invited students. Close this and try again." : "";

  // who was invited when the sheet opened, so a save sends only the difference
  const base = useMemo<Student[]>(() => (iq.data ?? []).map((x) => ({ id: x.student_id, name: x.full_name?.trim() || "Student", centre: x.centre_name, locked: x.status != null })).sort(byName), [iq.data]);
  const initial = useMemo(() => new Set(base.map((s) => s.id)), [base]);
  const selected = useMemo(() => { const m = new Map<string, Student>(); base.filter((s) => !removed.has(s.id)).forEach((s) => m.set(s.id, s)); added.forEach((s) => { if (!m.has(s.id)) m.set(s.id, s); }); return [...m.values()].sort(byName); }, [base, added, removed]);
  const studentsReady = !edit || (!!iq.data && !iq.refreshing);

  const addStudents = (list: Student[]) => { setRemoved((r) => { const n = new Set(r); list.forEach((s) => n.delete(s.id)); return n; }); setAdded((cur) => { const m = new Map(cur.map((s) => [s.id, s])); list.forEach((s) => { if (!initial.has(s.id)) m.set(s.id, s); }); return [...m.values()]; }); };
  const removeStudent = (id: string) => { setAdded((cur) => cur.filter((s) => s.id !== id)); if (initial.has(id)) setRemoved((r) => new Set(r).add(id)); };

  const min = useMemo(() => toWallInput(now()), []); const max = useMemo(() => toWallInput(now() + 29 * 864e5), []);
  const lengths = LENGTHS.some(([m]) => m === minutes) ? LENGTHS : [...LENGTHS, [minutes, `${minutes} min`] as [number, string]].sort((a, b) => a[0] - b[0]);
  const ready = !!centre && !!course && !!lesson && !!start && (!admin || !!edit || !!who) && studentsReady;

  const save = async () => {
    setErr("");
    const startIso = new Date(fromWallInput(start)).toISOString();
    if (!edit) {
      const r = await run("Creating class…", async () => mutate.rpc<string>("create_custom_class", {
        p_centre_id: centre, p_course_id: course, p_lesson_id: lesson, p_start: startIso, p_minutes: minutes, p_instructor_id: admin ? who : null, p_note: note.trim() || null, p_student_ids: selected.map((s) => s.id),
      }, { invalidates: ["sessions"] }), { quiet: true });
      if (!r.ok) return setErr(r.message);
      const n = selected.length;
      toast(n === 0 ? "Custom class created." : `Custom class created. ${n} ${n === 1 ? "student" : "students"} invited.`);
      onSaved(); onClose(); return;
    }
    const add = selected.filter((s) => !initial.has(s.id)).map((s) => s.id);
    const remove = [...initial].filter((id) => !selected.some((s) => s.id === id));
    const r = await run("Saving…", async () => {
      const m = await mutate.rpc<{ added: number; removed: number; not_eligible: number; kept: number }>("edit_custom_class", {
        p_session_id: edit.id, p_centre_id: centre, p_course_id: course, p_lesson_id: lesson, p_start: startIso, p_minutes: minutes, p_note: note.trim(), p_add: add, p_remove: remove,
      }, { invalidates: ["sessions"] });
      return m.status === "done" ? m.data : { added: 0, removed: 0, not_eligible: 0, kept: 0 };
    }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    const extra = [r.data.not_eligible > 0 ? `${r.data.not_eligible} couldn't be added.` : "", r.data.kept > 0 ? `${r.data.kept} already checked in, so they stay on the list.` : ""].filter(Boolean).join(" ");
    toast(["Saved.", extra].filter(Boolean).join(" "));
    onSaved(); onClose();
  };

  return (
    <Sheet open onClose={onClose} title={edit ? "Edit custom class" : "New custom class"}>
      <View style={{ gap: 16 }}>
        <Err>{loadErr}</Err>
        <SelectSheet label="Centre" value={centre} placeholder={centres ? "Choose a centre" : "Loading…"} options={(centres ?? []).map((c) => ({ value: c.id, label: placeLabel(c) }))} onChange={setCentre} />
        <SelectSheet label="Course" value={course} placeholder="Choose a course" options={courses.map((c) => ({ value: c.id, label: c.title }))} onChange={(v) => { setCourse(v); setLesson(""); }} />
        <SelectSheet label="Topic" value={lesson} placeholder={course ? (lessons.length ? "Choose a topic" : "Loading…") : "Choose a course first"} options={lessons.map((l) => ({ value: l.id, label: `${l.lesson_no}. ${l.title}` }))} onChange={setLesson} />
        {admin && !edit && <SelectSheet label="Instructor" value={who} placeholder="Choose an instructor" options={people.map((x) => ({ value: x.id, label: x.name }))} onChange={setWho} />}
        <DateTimeField label="Starts (centre time)" value={start} min={edit ? undefined : min} max={max} onChange={setStart} />
        <SelectSheet label="Length" value={String(minutes)} options={lengths.map(([m, t]) => ({ value: String(m), label: t }))} onChange={(v) => setMinutes(Number(v))} />
        <Field label="Note for students (optional)" value={note} maxLength={300} placeholder="For example: bring your laptop" onChangeText={setNote} />
        {studentsReady
          ? <CustomClassStudents selected={selected} onAdd={addStudents} onRemove={removeStudent} centres={centres ?? []} courses={courses} />
          : <Text size={14} tone="muted">Loading students…</Text>}
        <Err>{err}</Err>
        <Button disabled={!ready} onPress={save}>{edit ? "Save changes" : "Create custom class"}</Button>
      </View>
    </Sheet>
  );
}
