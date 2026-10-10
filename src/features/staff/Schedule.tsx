// Port of web pages/Schedule.tsx. Class days per centre, and course runs (when a course begins and ends there).
// Every change is online-only: the server builds or cancels the class sessions and tells students.
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { friendly, ok } from "@/core/errors";
import { mutate, useQuery, useRpc } from "@/data";
import { place } from "@/shared/web/centre";
import { addDays, addMonths, fmtDay, today as todayIso } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Button, Card, DateField, Empty, Err, Heading, Icon, Sheet, SelectSheet, Skeleton, Text, TimeField, useFeedback } from "@/ui";

const DAY = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_OPTS = DAY.slice(1).map((n, k) => ({ value: String(k + 1), label: n }));
const hm = (t: string) => t.slice(0, 5);
const nice = (s: string) => fmtDay(s, { day: "numeric", month: "short", year: "numeric" });

type DayRow = { day: string; start: string; end: string };
type RunForm = { id: string; course: string; start: string; end: string };
type Last = Record<string, { n: number; last: string; staffed: number }>;
type Data = { days: any[]; runs: any[]; last: Last };

export default function Schedule() {
  const { p } = useTheme(); const router = useRouter(); const { run, confirm, toast } = useFeedback();
  const today = todayIso();
  const [pick, setPick] = useState(""); const [dayForm, setDayForm] = useState<DayRow[] | null>(null); const [rf, setRf] = useState<RunForm | null>(null); const [err, setErr] = useState("");

  const aq = useRpc<boolean>("am_i_admin", {}, { tags: ["roles"], ttlMs: 10 * 60_000 }); const admin = aq.data === undefined ? undefined : Boolean(aq.data);
  const cq = useQuery<any[]>({ key: ["scheduleCentres"], tags: ["centres"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("centres").select("id,name,city,address").eq("is_active", true).order("city")) as any[]) ?? [] });
  const kq = useQuery<any[]>({ key: ["scheduleCourses"], tags: ["courses"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("courses").select("id,title,total_sessions").eq("is_active", true).order("sort_order")) as any[]) ?? [] });
  const centres = cq.data; const courses = kq.data ?? [];
  const centre = pick || centres?.[0]?.id || "";

  const dq = useQuery<Data>({
    key: ["schedule", centre], enabled: !!centre, tags: ["schedule", "sessions"], ttlMs: 30_000,
    fn: async (sb) => {
      const [d, r] = await Promise.all([
        sb.from("centre_class_days").select("id,day_of_week,start_time,end_time").eq("centre_id", centre).order("day_of_week"),
        sb.from("course_runs").select("id,course_id,start_date,end_date,status,cancel_reason,courses(title)").eq("centre_id", centre).order("start_date", { ascending: false }),
      ]);
      if (d.error || r.error) throw d.error ?? r.error;
      const ids = (r.data ?? []).filter((x: any) => x.status === "scheduled").map((x: any) => x.id);
      const last: Last = {};
      if (ids.length) {
        const s = await sb.from("class_sessions").select("run_id,session_date,instructor_id").in("run_id", ids).neq("status", "cancelled");
        (s.data ?? []).forEach((x: any) => { const c = last[x.run_id] ?? { n: 0, last: "", staffed: 0 }; c.n++; if (x.instructor_id) c.staffed++; if (x.session_date > c.last) c.last = x.session_date; last[x.run_id] = c; });
      }
      return { days: d.data ?? [], runs: r.data ?? [], last };
    },
  });
  const days = dq.data?.days; const runs = dq.data?.runs; const last = useMemo<Last>(() => dq.data?.last ?? {}, [dq.data]);
  const loadErr = dq.error ? friendly(dq.error) : "";
  const reload = () => dq.refetch();

  const state = (x: any) => x.status === "cancelled" ? "Cancelled" : (last[x.id]?.last ?? x.end_date) < today ? "Ended" : x.start_date <= today ? "Running" : "Upcoming";
  const editable = (x: any) => x.status === "scheduled" && (last[x.id]?.last ?? x.end_date) >= today;
  // A course whose latest run is about to finish, with nothing scheduled after it
  const ending = useMemo(() => {
    const byCourse = new Map<string, any>();
    (runs ?? []).filter((x) => x.status === "scheduled").forEach((x) => { const c = byCourse.get(x.course_id); if (!c || x.start_date > c.start_date) byCourse.set(x.course_id, x); });
    return [...byCourse.values()].map((x) => ({ x, end: last[x.id]?.last ?? x.end_date })).filter(({ end }) => end >= today && end <= addDays(today, 14));
  }, [runs, last, today]);

  const openNew = (courseId = "", start = "") => { setErr(""); setRf({ id: "", course: courseId, start, end: "" }); };
  const openEdit = (x: any) => { setErr(""); setRf({ id: x.id, course: x.course_id, start: x.start_date, end: x.end_date }); };
  const suggest = async () => {
    if (!rf?.course || !rf.start) return setErr("Pick the course and start date first.");
    setErr("");
    try {
      const m = await mutate.online(async (sb) => ok(await sb.rpc("suggest_run_end", { p_centre_id: centre, p_course_id: rf.course, p_start: rf.start })) as string | null);
      if (m) setRf({ ...rf, end: m });
    } catch (e) { setErr(friendly(e)); }
  };
  const saveRun = async () => {
    if (!rf) return; setErr("");
    const r = await run(rf.id ? "Saving run…" : "Scheduling…", async () => {
      const m = await mutate.rpc<any>("save_course_run", { p_run_id: rf.id || null, p_centre_id: centre, p_course_id: rf.course, p_instructor_id: null, p_start: rf.start, p_end: rf.end }, { invalidates: ["schedule", "sessions"] });
      await reload(); return m.status === "done" ? m.data : null;
    }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    setRf(null);
    const short = r.data?.short_by > 0;
    toast(short ? `Saved, but only ${r.data.planned} of ${r.data.expected} classes fit. Extend the end date.` : "Saved", short ? "bad" : "ok");
  };
  const cancelRun = async (x: any) => {
    if (!(await confirm({ title: "Cancel this run?", message: `${x.courses?.title}, ${nice(x.start_date)} to ${nice(x.end_date)}. Upcoming classes are cancelled and enrolled students are told.`, confirmLabel: "Cancel run", danger: true }))) return;
    await run("Cancelling…", async () => { await mutate.rpc("cancel_course_run", { p_run_id: x.id, p_reason: null }, { invalidates: ["schedule", "sessions"] }); await reload(); }, { success: "Run cancelled" });
  };
  const saveDays = async () => {
    if (!dayForm) return; setErr("");
    const r = await run("Saving class days…", async () => { await mutate.rpc("save_centre_class_days", { p_centre_id: centre, p_days: dayForm.map((d) => ({ day: Number(d.day), start: d.start, end: d.end })) }, { invalidates: ["schedule"] }); await reload(); }, { success: "Class days saved", quiet: true });
    if (!r.ok) return setErr(r.message);
    setDayForm(null);
  };
  const setDay = (i: number, patch: Partial<DayRow>) => setDayForm((f) => f && f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const ctr = centres?.find((c) => c.id === centre);
  const link = (c: string, k: string, label: string) => <Pressable accessibilityRole="link" onPress={() => router.push(`/roster?centre=${c}&course=${k}`)} style={{ minHeight: 36, justifyContent: "center" }}><Text size={14} weight="medium" tone="accent">{label}</Text></Pressable>;

  if (!centres) return <View style={{ gap: 12 }}><Skeleton height={32} style={{ width: "50%" }} /><Skeleton height={128} /></View>;
  return (
    <View style={{ gap: 20 }}>
      <Heading size={26} lh={32}>Schedule</Heading>
      {centres.length === 0 ? <Empty title="No centres yet." /> : <>
        <SelectSheet label="Centre" value={centre} options={centres.map((c) => ({ value: c.id, label: place(c) }))} onChange={setPick} />
        {loadErr ? <View style={{ gap: 8 }}><Err>{loadErr}</Err><Button variant="secondary" onPress={reload}>Try again</Button></View> : null}

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Heading size={18}>Class days</Heading>
            {admin && <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => { setErr(""); setDayForm(days?.length ? days.map((d) => ({ day: String(d.day_of_week), start: hm(d.start_time), end: hm(d.end_time) })) : [{ day: "1", start: "10:00", end: "13:00" }]); }}><Text size={14} weight="medium" tone="accent">{days?.length ? "Edit" : "Set up"}</Text></Pressable>}
          </View>
          {!days ? <Skeleton height={64} /> : days.length === 0 ? <Card><Text size={14} tone="muted">{admin ? `No class days for ${place(ctr ?? { name: "this centre" })} yet. Set them up before scheduling courses.` : "This centre has no class days yet. Ask an admin to set them."}</Text></Card>
            : <Card style={{ paddingVertical: 4 }}>{days.map((d, i) => <View key={d.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: p.c.line }}><Text weight="medium">{DAY[d.day_of_week]}</Text><Text tone="muted" num>{hm(d.start_time)} to {hm(d.end_time)}</Text></View>)}</Card>}
        </View>

        {ending.map(({ x, end }) => (
          <Card key={x.id} style={{ gap: 8, borderColor: p.a("warn", 0.4), backgroundColor: p.a("warn", 0.1) }}>
            <Text weight="medium">{x.courses?.title} ends {nice(end)}</Text>
            <Text size={14} tone="muted">Nothing is scheduled after it. Set when it begins next.</Text>
            <Button style={{ height: 40 }} disabled={!days?.length} onPress={() => openNew(x.course_id, addDays(end, 1) > today ? addDays(end, 1) : today)}>Schedule next run</Button>
          </Card>))}

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Heading size={18}>Course runs</Heading><Button style={{ height: 40 }} disabled={!days?.length} onPress={() => openNew()}>+ New run</Button></View>
          {!runs ? <Skeleton height={96} /> : runs.length === 0 ? <Card><Text size={14} tone="muted" align="center">No runs yet. A run says when a course begins and ends here.</Text></Card>
            : runs.map((x) => { const s = state(x); const l = last[x.id]; return (
              <Card key={x.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="medium">{x.courses?.title}</Text>
                    <Text size={14} tone="muted" num>{nice(x.start_date)} to {nice(l?.last ?? x.end_date)}{l ? ` · ${l.n} classes` : ""}</Text>
                    {admin && l && x.status === "scheduled" && <Text size={14} tone={l.staffed === l.n ? "ok" : "muted"}>{l.staffed === 0 ? "No instructors yet" : l.staffed === l.n ? "Every class has an instructor" : `${l.staffed} of ${l.n} classes have an instructor`}</Text>}
                  </View>
                  <Badge tone={s === "Running" ? "ok" : s === "Upcoming" ? "warn" : "muted"}>{s}</Badge>
                </View>
                {admin && editable(x) && link(centre, x.course_id, (l?.staffed ?? 0) === (l?.n ?? 0) && l ? "Open roster" : "Assign instructors")}
                {editable(x) && <View style={{ flexDirection: "row", gap: 8 }}><Button variant="secondary" style={{ height: 40, flex: 1 }} onPress={() => openEdit(x)}>Edit</Button><Button variant="ghost" style={{ height: 40, flex: 1 }} onPress={() => cancelRun(x)}><Text size={15} weight="medium" tone="bad">Cancel run</Text></Button></View>}
              </Card>); })}
        </View>
      </>}

      <Sheet open={!!dayForm} onClose={() => setDayForm(null)} title={`Class days · ${ctr ? place(ctr) : ""}`}>
        {dayForm && <View style={{ gap: 12 }}>
          <Text size={14} tone="muted">Every course here meets on these days and times.</Text>
          {dayForm.map((d, i) => (
            <View key={i} style={{ gap: 8, borderRadius: 12, backgroundColor: p.c.sunken, padding: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <View style={{ flex: 1 }}><SelectSheet label="Day" value={d.day} options={DAY_OPTS} onChange={(v) => setDay(i, { day: v })} /></View>
                {dayForm.length > 1 && <Pressable accessibilityLabel="Remove day" onPress={() => setDayForm(dayForm.filter((_, j) => j !== i))} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} color={p.c.bad} /></Pressable>}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1 }}><TimeField label="Starts" value={d.start} onChange={(v) => setDay(i, { start: v })} /></View><View style={{ flex: 1 }}><TimeField label="Ends" value={d.end} onChange={(v) => setDay(i, { end: v })} /></View></View>
            </View>))}
          {dayForm.length < 7 && <Button variant="secondary" onPress={() => setDayForm([...dayForm, { day: String((Math.max(...dayForm.map((d) => Number(d.day))) % 7) + 1), start: dayForm[dayForm.length - 1].start, end: dayForm[dayForm.length - 1].end }])}>+ Add a day</Button>}
          <Err>{err}</Err>
          <Button disabled={dayForm.some((d) => !d.start || !d.end)} onPress={saveDays}>Save class days</Button>
        </View>}
      </Sheet>

      <Sheet open={!!rf} onClose={() => setRf(null)} title={rf?.id ? "Edit run" : "New run"}>
        {rf && <View style={{ gap: 12 }}>
          <Text size={14} tone="muted">{ctr ? place(ctr) : ""}{days?.length ? ` · ${days.map((d) => DAY[d.day_of_week].slice(0, 3)).join(", ")}` : ""}</Text>
          <View style={{ opacity: rf.id ? 0.6 : 1 }} pointerEvents={rf.id ? "none" : "auto"}><SelectSheet label="Course" value={rf.course} placeholder="Choose course…" options={courses.map((c: any) => ({ value: c.id, label: c.title }))} onChange={(v) => setRf({ ...rf, course: v, end: "" })} /></View>
          <DateField label="Begins" value={rf.start} min={rf.id ? undefined : today} max={addMonths(today, 4)} onChange={(v) => setRf({ ...rf, start: v, end: "" })} />
          <DateField label="Ends" value={rf.end} min={rf.start || today} onChange={(v) => setRf({ ...rf, end: v })} />
          <Pressable accessibilityRole="button" onPress={suggest} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} weight="medium" tone="accent">Suggest the end date</Text></Pressable>
          <Text size={12} tone="muted">You can schedule up to four months ahead. A run can{"'"}t last longer than four months. Instructors are assigned class by class on the Roster.</Text>
          <Err>{err}</Err>
          <Button disabled={!rf.course || !rf.start || !rf.end} onPress={saveRun}>{rf.id ? "Save" : "Schedule run"}</Button>
        </View>}
      </Sheet>
    </View>
  );
}
