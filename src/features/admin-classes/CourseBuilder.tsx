// Port of web pages/CourseBuilder.tsx. Admin: create courses and build each one class by class (details, prerequisites, outline).
// Everything is saved in ONE call (save_course) so a course is never left half-written, and after every save the screen re-reads the database and checks that what is stored is
// what was typed: a save that didn't land is reported. Online-only. Divergence: the web's sticky save bar becomes a Save button at the top (when there are changes) and one at the end.
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { friendly, ok, rawMessage } from "@/core/errors";
import { online, useQuery } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Area, Badge, Button, Card, Empty, Err, Field, Heading, Icon, PageHeader, Sheet, Skeleton, SwitchRow, Text, useFeedback } from "@/ui";
import { MAX_CLASSES, blankRow, hasText, same, withKey, type Details, type Row, type Snapshot } from "./courseDiff";

type SB = Parameters<Parameters<typeof online>[0]>[0];
type Other = { id: string; title: string; code: string };
type Loaded = { snap: Snapshot; others: Other[] };
type Problem = { message: string; detail: string } | null;
type CourseRow = { id: string; code: string; title: string; total_sessions: number; is_active: boolean; course_lessons: { id: string; summary: string | null }[] };

async function fetchCourse(sb: SB, id: string): Promise<Loaded> {
  const [c, l, p, all] = await Promise.all([
    sb.from("courses").select("code,title,summary,is_active,total_sessions").eq("id", id).maybeSingle(),
    sb.from("course_lessons").select("lesson_no,title,summary").eq("course_id", id).order("lesson_no"),
    sb.from("course_prerequisites").select("prerequisite_id,group_no").eq("course_id", id).order("group_no"),
    sb.from("courses").select("id,title,code").neq("id", id).order("sort_order"),
  ]);
  if (c.error) throw c.error; if (!c.data) throw new Error("course_not_found");
  if (l.error) throw l.error; if (p.error) throw p.error; if (all.error) throw all.error;
  const have = new Map((l.data ?? []).map((x) => [x.lesson_no as number, x]));
  const total = Math.max(1, c.data.total_sessions as number);
  const rows: Row[] = Array.from({ length: total }, (_, i) => { const x = have.get(i + 1); return withKey(x?.title ?? "", x?.summary ?? ""); });
  const byGroup = new Map<number, string[]>();
  (p.data ?? []).forEach((x) => byGroup.set(x.group_no as number, [...(byGroup.get(x.group_no as number) ?? []), x.prerequisite_id as string]));
  return {
    snap: { details: { code: c.data.code, title: c.data.title, summary: c.data.summary ?? "", active: c.data.is_active }, rows, groups: [...byGroup.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]) },
    others: (all.data ?? []) as Other[],
  };
}

function Warn({ items }: { items: string[] }) {
  const { p } = useTheme();
  return items.length ? <View style={{ gap: 4, borderRadius: radius.xl, backgroundColor: p.a("warn", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}>{items.map((x) => <Text key={x} size={14} tone="warn">• {x}</Text>)}</View> : null;
}
function ProblemBox({ e }: { e: Problem }) {
  const { p } = useTheme(); const [more, setMore] = useState(false);
  if (!e) return null;
  return (
    <View accessibilityRole="alert" style={{ gap: 4, borderRadius: radius.xl, backgroundColor: p.a("bad", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}>
      <Text size={14} tone="bad">{e.message}</Text>
      {e.detail && e.detail !== e.message && <><Pressable accessibilityRole="button" onPress={() => setMore(!more)} style={{ minHeight: 32, justifyContent: "center" }}><Text size={12} tone="bad">{more ? "Hide technical details" : "Technical details"}</Text></Pressable>{more && <Text size={12} tone="bad" selectable>{e.detail}</Text>}</>}
    </View>
  );
}
function IconBtn({ label, onPress, disabled, danger, icon }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; icon: "chevronUp" | "chevronDown" | "close" }) {
  const { p } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}><Icon name={icon} size={18} color={danger ? p.c.bad : p.c.muted} /></Pressable>;
}

// ───────────────────────────── course list ─────────────────────────────
function CourseList() {
  const router = useRouter(); const { run } = useFeedback();
  const [nf, setNf] = useState<{ title: string; code: string; summary: string } | null>(null); const [show, setShow] = useState(false); const [err, setErr] = useState("");
  const q = useQuery<CourseRow[]>({ key: ["courseList"], tags: ["courses"], ttlMs: 30_000, fn: async (sb) => (ok(await sb.from("courses").select("id,code,title,total_sessions,is_active,course_lessons(id,summary)").order("sort_order")) as unknown as CourseRow[]) ?? [] });
  const rows = q.data ?? (q.error ? [] : undefined); const loadErr = q.error ? friendly(q.error) : "";
  const codeOk = !!nf && /^[A-Za-z0-9_-]{2,20}$/.test(nf.code.trim());

  const create = async () => {
    if (!nf) return; setShow(true); setErr("");
    if (!nf.title.trim() || !codeOk) return;
    const r = await run("Creating course…", () => online(async (sb) => {
      const { data, error } = await sb.rpc("save_course", { p_course_id: null, p_code: nf.code.trim(), p_title: nf.title.trim(), p_summary: nf.summary.trim() || null, p_is_active: false, p_lessons: null, p_prerequisites: null });
      if (error) throw error;
      return data as string;
    }, { invalidates: ["courses"] }), { success: "Course created. Add its classes next.", quiet: true });
    if (!r.ok) return setErr(r.message);
    setNf(null); router.push(`/courses/${r.data}`);
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}><Heading size={26} lh={32}>Course builder</Heading><Text size={14} tone="muted">Create courses, set how many classes each has and what every class covers.</Text></View>
        <Button style={{ height: 40 }} onPress={() => { setErr(""); setShow(false); setNf({ title: "", code: "", summary: "" }); }}>+ New</Button>
      </View>
      {loadErr ? <View style={{ gap: 8 }}><Err>{loadErr}</Err><Button variant="secondary" onPress={() => q.refetch()}>Try again</Button></View> : null}
      {!rows ? <><Skeleton height={80} /><Skeleton height={80} /></> : rows.length === 0 && !loadErr ? <Empty title="No courses yet. Tap “+ New” to create the first one." /> : rows.map((c) => {
        const described = c.course_lessons.filter((l) => l.summary && l.summary.trim()).length;
        return (
          <Card key={c.id} onPress={() => router.push(`/courses/${c.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{c.title}</Text><Text size={14} tone="muted">{c.code} · {c.total_sessions} {c.total_sessions === 1 ? "class" : "classes"} · {described} of {c.course_lessons.length} described</Text></View>
            {!c.is_active && <Badge>Hidden</Badge>}<Icon name="chevronRight" size={18} />
          </Card>);
      })}
      <Sheet open={!!nf} onClose={() => setNf(null)} title="New course">
        {nf && <View style={{ gap: 12 }}>
          <Field label="Course name" value={nf.title} maxLength={120} onChangeText={(v) => setNf({ ...nf, title: v })} placeholder="e.g. AI-Powered Web Development" />
          <Field label="Short code (can't be changed later)" value={nf.code} maxLength={20} placeholder="e.g. WEB" autoCapitalize="characters" onChangeText={(v) => setNf({ ...nf, code: v.toUpperCase() })} />
          <Area label="Summary (shown to students)" maxLength={500} value={nf.summary} onChangeText={(v) => setNf({ ...nf, summary: v })} rows={3} />
          <Text size={14} tone="muted">{"The new course starts hidden. You'll add its classes next, then turn on “Visible to students”."}</Text>
          {show && <Warn items={[...(!nf.title.trim() ? ["Give the course a name."] : []), ...(!codeOk ? ["Add a short code (2–20 letters or numbers)."] : [])]} />}
          <Err>{err}</Err>
          <Button onPress={create}>Create course</Button>
        </View>}
      </Sheet>
    </View>
  );
}

// ───────────────────────────── course editor ─────────────────────────────
function Editor({ id }: { id: string }) {
  const { p } = useTheme(); const router = useRouter(); const { run, confirm } = useFeedback();
  const q = useQuery<Loaded>({ key: ["course", id], tags: ["courses"], ttlMs: 0, fn: (sb) => fetchCourse(sb, id) });
  // fresh React keys every time the stored copy loads, so a cached copy from an earlier run can never clash with rows added now
  const loaded = useMemo<Loaded | undefined>(() => q.data && { ...q.data, snap: { ...q.data.snap, rows: q.data.snap.rows.map((r) => withKey(r.title, r.description)) } }, [q.data]);
  const base = loaded?.snap; const others = loaded?.others ?? [];
  const [draft, setDraft] = useState<Snapshot | null>(null); const [countText, setCountText] = useState<string | null>(null);
  const [show, setShow] = useState(false); const [err, setErr] = useState<Problem>(null);
  const d = draft ?? base; const dirty = !!draft && !!base && !same(draft, base);
  const loadErr = q.error && !loaded ? friendly(q.error) : "";

  const back = async () => { if (!dirty || await confirm({ title: "Leave without saving?", message: "Your changes to this course haven't been saved.", confirmLabel: "Leave", cancelLabel: "Keep editing", danger: true })) router.navigate("/courses"); };
  const BackLink = <Pressable accessibilityRole="link" onPress={back} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44 }}><Icon name="arrowLeft" size={16} /><Text size={14} tone="muted">All courses</Text></Pressable>;
  if (loadErr) return <View style={{ gap: 12 }}>{BackLink}<Err>{loadErr}</Err><Button variant="secondary" onPress={() => q.refetch()}>Try again</Button></View>;
  if (!d || !base) return <View style={{ gap: 12 }}><Skeleton height={32} style={{ width: "66%" }} /><Skeleton height={160} /><Skeleton height={160} /></View>;

  const setD = (s: Snapshot) => setDraft(s);
  const setDetail = (x: Partial<Details>) => setD({ ...d, details: { ...d.details, ...x } });
  const setRows = (rows: Row[]) => { setD({ ...d, rows }); setCountText(null); };
  const setRow = (i: number, x: Partial<Row>) => setD({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, ...x } : r)) });
  const move = (i: number, to: number) => { if (to < 0 || to >= d.rows.length) return; const rows = [...d.rows]; const [x] = rows.splice(i, 1); rows.splice(to, 0, x); setRows(rows); };
  const addRow = () => { if (d.rows.length < MAX_CLASSES) setRows([...d.rows, blankRow()]); };
  const removeRow = async (i: number) => {
    if (d.rows.length <= 1) return;
    if (hasText(d.rows[i]) && !(await confirm({ title: `Remove class ${i + 1}?`, message: "Its topic and description are removed when you save.", confirmLabel: "Remove class", danger: true }))) return;
    setRows(d.rows.filter((_, j) => j !== i));
  };
  const changeCount = async (n: number) => {
    if (!(n >= 1 && n <= MAX_CLASSES) || n === d.rows.length) return setCountText(null); // not a usable number: put the old one back
    if (n < d.rows.length) {
      const lost = d.rows.slice(n);
      if (lost.some(hasText) && !(await confirm({ title: lost.length === 1 ? `Remove class ${n + 1}?` : `Remove classes ${n + 1}–${d.rows.length}?`, message: "What you've written for them is removed when you save.", confirmLabel: "Remove", danger: true }))) return setCountText(null);
      return setRows(d.rows.slice(0, n));
    }
    setRows([...d.rows, ...Array.from({ length: n - d.rows.length }, blankRow)]);
  };
  const setGroup = (gi: number, ids: string[]) => setD({ ...d, groups: d.groups.map((g, j) => (j === gi ? ids : g)) });
  const toggleIn = (gi: number, cid: string) => setGroup(gi, d.groups[gi].includes(cid) ? d.groups[gi].filter((x) => x !== cid) : [...d.groups[gi], cid]);

  const problems: string[] = [];
  if (!d.details.title.trim()) problems.push("Give the course a name.");
  d.rows.forEach((r, i) => { if (!r.title.trim()) problems.push(`Class ${i + 1} needs a topic.`); });

  const save = async () => {
    setShow(true); setErr(null);
    if (problems.length) return;
    const sent = d;
    const r = await run("Saving course…", async () => {
      await online(async (sb) => {
        const { error } = await sb.rpc("save_course", {
          p_course_id: id, p_code: sent.details.code, p_title: sent.details.title.trim(), p_summary: sent.details.summary.trim() || null, p_is_active: sent.details.active,
          p_lessons: sent.rows.map((x) => ({ title: x.title.trim(), description: x.description.trim() })), p_prerequisites: sent.groups.filter((g) => g.length),
        });
        if (error) throw error;
        // Read it back: only call it saved if the database really holds what was typed.
        const fresh = await fetchCourse(sb, id);
        if (!same(fresh.snap, sent)) throw new Error("not_saved");
      }, { invalidates: ["courses"] });
      await q.refetch();
    }, { success: "Course saved", quiet: true });
    if (!r.ok) return setErr({ message: r.message, detail: rawMessage(r.error) });
    setDraft(null); setCountText(null); setShow(false);
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete “${base.details.title}”?`, message: "This permanently deletes the course, every class outline in it and its project briefs, and removes it from learning pathways. It can't be deleted while students, classes or runs use it, or another course requires it. Hide it instead.", confirmLabel: "Delete course", danger: true }))) return;
    setErr(null);
    const r = await run("Deleting course…", () => online(async (sb) => { const { error } = await sb.rpc("delete_course", { p_course_id: id }); if (error) throw error; }, { invalidates: ["courses"] }), { success: "Course deleted", quiet: true });
    if (!r.ok) return setErr({ message: r.message, detail: rawMessage(r.error) });
    router.replace("/courses");
  };

  const described = d.rows.filter((r) => r.description.trim()).length;
  return (
    <View style={{ gap: 20 }}>
      {BackLink}
      <PageHeader title={base.details.title} sub={`${base.details.code} · ${d.rows.length} ${d.rows.length === 1 ? "class" : "classes"} · ${described} described`} />
      {dirty && <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text size={14} weight="medium" tone="warn" style={{ flex: 1 }}>You have unsaved changes</Text><Button style={{ height: 40 }} onPress={save}>Save course</Button></View>}

      <Card style={{ gap: 12 }}>
        <Heading size={18}>Details</Heading>
        <Field label="Course name" maxLength={120} value={d.details.title} onChangeText={(v) => setDetail({ title: v })} error={show && !d.details.title.trim()} />
        <Area label="Summary (shown to students)" maxLength={500} value={d.details.summary} onChangeText={(v) => setDetail({ summary: v })} rows={3} />
        <SwitchRow title="Visible to students" hint="Students can pick this course when they enrol. Turn it off to hide it without deleting anything." value={d.details.active} onChange={(v) => setDetail({ active: v })} />
      </Card>

      <Card style={{ gap: 12 }}>
        <View><Heading size={18}>Prerequisites</Heading><Text size={14} tone="muted">Students must have finished <Text size={14} weight="medium">one course from every requirement</Text> below before they can take this course.</Text></View>
        {d.groups.length === 0 && <Text size={14} tone="muted">No prerequisites. Anyone can take this course.</Text>}
        {d.groups.map((g, gi) => (
          <View key={gi} style={{ gap: 8, borderRadius: radius.xl, backgroundColor: p.a("sunken", 0.6), padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text size={14} weight="medium">Requirement {gi + 1}: any one of</Text><Pressable accessibilityRole="button" onPress={() => setD({ ...d, groups: d.groups.filter((_, j) => j !== gi) })} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="bad">Remove</Text></Pressable></View>
            {others.length === 0 ? <Text size={14} tone="muted">There are no other courses yet.</Text> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{others.map((o) => (
              <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: g.includes(o.id) }} onPress={() => toggleIn(gi, o.id)} style={{ minHeight: 36, justifyContent: "center", borderRadius: 999, paddingHorizontal: 12, backgroundColor: g.includes(o.id) ? p.c.accent : p.c.surface, borderWidth: g.includes(o.id) ? 0 : 1, borderColor: p.c.line }}>
                <Text size={14} style={{ color: g.includes(o.id) ? p.c.accentInk : p.c.ink }}>{o.title}</Text></Pressable>))}</View>}
            {g.length === 0 && <Text size={12} tone="warn">Pick at least one course, or remove this requirement. Empty requirements are ignored.</Text>}
          </View>))}
        <Button variant="secondary" style={{ height: 40 }} disabled={others.length === 0} onPress={() => setD({ ...d, groups: [...d.groups, []] })}>+ Add a requirement</Button>
      </Card>

      <View style={{ gap: 12 }}>
        <Heading size={18}>Classes</Heading>
        <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}><Text weight="medium">Number of classes</Text><Text size={14} tone="muted">Students are expected to attend most of them.</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable accessibilityLabel="Fewer classes" disabled={d.rows.length <= 1} onPress={() => changeCount(d.rows.length - 1)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: p.c.sunken, opacity: d.rows.length <= 1 ? 0.4 : 1 }}><Text size={18}>−</Text></Pressable>
            <TextInput accessibilityLabel="Number of classes" keyboardType="number-pad" value={countText ?? String(d.rows.length)} onChangeText={(v) => setCountText(v.replace(/\D/g, "").slice(0, 2))} onBlur={() => changeCount(Number(countText ?? d.rows.length))} onSubmitEditing={() => changeCount(Number(countText ?? d.rows.length))}
              style={{ width: 48, height: 40, borderRadius: radius.xl, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, textAlign: "center", fontFamily: "Geist-SemiBold", fontSize: 16, color: p.c.ink, padding: 0 }} />
            <Pressable accessibilityLabel="More classes" disabled={d.rows.length >= MAX_CLASSES} onPress={() => changeCount(d.rows.length + 1)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: p.c.sunken, opacity: d.rows.length >= MAX_CLASSES ? 0.4 : 1 }}><Text size={18}>+</Text></Pressable>
          </View>
        </Card>

        {d.rows.map((r, i) => (
          <Card key={r.k} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: p.a("accent", 0.1) }}><Text size={14} weight="semibold" tone="accent" num>{i + 1}</Text></View>
              <Text size={14} weight="medium" style={{ flex: 1 }}>Class {i + 1}</Text>
              <IconBtn label={`Move class ${i + 1} up`} icon="chevronUp" disabled={i === 0} onPress={() => move(i, i - 1)} />
              <IconBtn label={`Move class ${i + 1} down`} icon="chevronDown" disabled={i === d.rows.length - 1} onPress={() => move(i, i + 1)} />
              <IconBtn label={`Remove class ${i + 1}`} icon="close" danger disabled={d.rows.length <= 1} onPress={() => removeRow(i)} />
            </View>
            <Field label={`Topic for class ${i + 1}`} placeholder="Topic" maxLength={120} value={r.title} onChangeText={(v) => setRow(i, { title: v })} error={show && !r.title.trim()} />
            <Area label={`What class ${i + 1} covers`} placeholder="What will be covered in this class?" maxLength={1000} value={r.description} onChangeText={(v) => setRow(i, { description: v })} rows={3} />
            {r.description.length > 800 && <Text size={12} tone="muted" align="right" num>{r.description.length}/1000</Text>}
          </Card>))}
        <Button variant="secondary" disabled={d.rows.length >= MAX_CLASSES} onPress={addRow}>+ Add a class</Button>
        <Text size={12} tone="muted">Classes are numbered in order. Moving or removing a class changes which topic each class number covers, including for students already part-way through.</Text>
      </View>

      <Card style={{ gap: 8, borderColor: p.a("bad", 0.3) }}>
        <Heading size={18} style={{ color: p.c.bad }}>Delete this course</Heading>
        <Text size={14} tone="muted">Permanently removes the course, its outline and project briefs. Not possible while students, classes or runs use it, or another course requires it. Hide it instead.</Text>
        <Button variant="secondary" onPress={remove}><Text size={15} weight="medium" tone="bad">Delete course…</Text></Button>
      </Card>

      {show && <Warn items={problems} />}
      <ProblemBox e={err} />
      <View style={{ gap: 6 }}>
        {dirty && <Text size={12} weight="medium" tone="warn" align="center">You have unsaved changes</Text>}
        <Button disabled={!dirty} onPress={save}>{dirty ? "Save course" : "All changes saved"}</Button>
      </View>
    </View>
  );
}

export default function CourseBuilder({ id }: { id?: string }) {
  const { roles } = useAuth();
  if (!roles.some((r) => r.role === "admin" || r.role === "super_admin")) return <Redirect href="/" />;
  return id ? <Editor key={id} id={id} /> : <CourseList />;
}
