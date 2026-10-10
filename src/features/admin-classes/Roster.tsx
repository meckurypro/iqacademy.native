// Port of web pages/Roster.tsx. The admin's staffing board: who teaches which class, where and when. Work at whatever size suits the moment: tap one class,
// give an instructor "this and every later class", or hand them a whole course at one centre or at every centre. Double-bookings are caught before saving.
// Reads are cached (the board opens offline, read-only); every assignment is online-only.
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { friendly, ok } from "@/core/errors";
import { useQuery } from "@/data";
import { addDays, byStart, classes, clock, first, label, locked, mondayOf, short, where, type P, type S, type Scope } from "@/shared/web/roster";
import { useTicker } from "@/shared/useTicker";
import { today as todayIso } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Badge, Button, Card, Chip, ChipRow, Err, Heading, Icon, Segmented, Skeleton, Text } from "@/ui";
import AssignSheet from "./AssignSheet";

export default function Roster() {
  const { p } = useTheme(); const router = useRouter(); useTicker(30_000); // "started" is decided by the clock
  const params = useLocalSearchParams<{ course?: string; centre?: string }>(); const deepCourse = params.course, deepCentre = params.centre;
  const [view, setView] = useState<"week" | "course">(deepCourse ? "course" : "week"); const [centre, setCentre] = useState(deepCentre ?? ""); const [gaps, setGaps] = useState(false);
  const [weekSel, setWeekSel] = useState(""); const [expanded, setExpanded] = useState<Set<string>>(() => new Set(deepCourse && deepCentre ? [`${deepCourse}:${deepCentre}`] : []));
  const [edit, setEdit] = useState<{ anchor: S; scope: Scope } | null>(null);

  const sq = useQuery<S[]>({
    key: ["roster", addDays(todayIso(), -1)], tags: ["sessions"], ttlMs: 30_000,
    fn: async (sb) => (ok(await sb.from("v_session_details").select("id,session_date,start_at,end_at,status,session_no,centre_id,centre_name,centre_city,centre_address,course_id,course_title,instructor_id,lesson_title,run_id")
      .in("status", ["scheduled", "in_progress"]).gte("session_date", addDays(todayIso(), -1)).order("start_at").limit(1000)) as S[]) ?? [],
  });
  const pq = useQuery<P[]>({
    key: ["rosterPeople"], tags: ["roles"], ttlMs: 5 * 60_000,
    fn: async (sb) => {
       
      const rows = (ok(await sb.from("user_roles").select("user_id,profiles!user_roles_user_id_fkey(full_name,avatar_url)").eq("role", "instructor").eq("is_active", true)) as any[]) ?? [];
      const m = new Map<string, P>(); rows.forEach((x) => m.set(x.user_id, { id: x.user_id, name: x.profiles?.full_name || "Instructor", avatar: x.profiles?.avatar_url ?? null }));
      return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  const ses = sq.data; const people = useMemo(() => pq.data ?? [], [pq.data]);
  const loadErr = sq.error && !ses ? friendly(sq.error) : ""; const peopleErr = pq.error && !pq.data ? friendly(pq.error) : "";

  const pmap = useMemo(() => new Map(people.map((x) => [x.id, x])), [people]);
  const centres = useMemo(() => { const m = new Map<string, string>(); (ses ?? []).forEach((s) => m.set(s.centre_id, where(s))); return [...m].sort((a, b) => a[1].localeCompare(b[1])); }, [ses]);
  const inCentre = useMemo(() => (ses ?? []).filter((s) => !centre || s.centre_id === centre), [ses, centre]);
  const upcoming = useMemo(() => inCentre.filter((s) => !locked(s)), [inCentre]);
  const open = upcoming.filter((s) => !s.instructor_id).length;

  // Start on a week that has classes in it
  const defaultWeek = useMemo(() => {
    if (!ses) return "";
    const thisWeek = mondayOf(todayIso()); const nextUp = ses.filter((s) => !locked(s)).sort(byStart)[0];
    const busy = ses.some((s) => s.session_date >= thisWeek && s.session_date < addDays(thisWeek, 7));
    return busy || !nextUp ? thisWeek : mondayOf(nextUp.session_date);
  }, [ses]);
  const week = weekSel || defaultWeek; const weekEnd = week ? addDays(week, 7) : "";
  const days = useMemo(() => {
    const list = gaps ? upcoming.filter((s) => !s.instructor_id) : inCentre.filter((s) => !!week && s.session_date >= week && s.session_date < weekEnd);
    const m = new Map<string, S[]>(); [...list].sort(byStart).forEach((s) => m.set(s.session_date, [...(m.get(s.session_date) ?? []), s])); return [...m];
  }, [gaps, upcoming, inCentre, week, weekEnd]);
  const courses = useMemo(() => {
    const m = new Map<string, { id: string; title: string; groups: Map<string, { id: string; name: string; list: S[] }> }>();
    upcoming.forEach((s) => { const c = m.get(s.course_id) ?? { id: s.course_id, title: s.course_title, groups: new Map() }; const g = c.groups.get(s.centre_id) ?? { id: s.centre_id, name: where(s), list: [] }; g.list.push(s); c.groups.set(s.centre_id, g); m.set(s.course_id, c); });
    return [...m.values()].map((c) => ({ ...c, groups: [...c.groups.values()].map((g) => ({ ...g, list: g.list.sort(byStart) })).filter((g) => !gaps || g.list.some((s) => !s.instructor_id)) })).filter((c) => c.groups.length).sort((a, b) => a.title.localeCompare(b.title));
  }, [upcoming, gaps]);

  const toggle = (k: string) => setExpanded((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const nameOf = (id: string | null) => (id ? first(pmap.get(id)?.name ?? "Instructor") : "");

  const row = (s: S) => {
    const x = s.instructor_id ? pmap.get(s.instructor_id) : undefined; const lk = locked(s);
    return (
      <Card key={s.id} onPress={lk ? undefined : () => setEdit({ anchor: s, scope: "class" })} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: lk ? 0.6 : 1 }}>
        <View style={{ width: 68 }}><Text size={14} weight="medium" num>{clock(s.start_at)}</Text><Text size={12} tone="muted" num>{clock(s.end_at)}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium" numberOfLines={1}>{s.course_title}</Text>
          <Text size={14} tone="muted" numberOfLines={1}>Class {s.session_no}{s.lesson_title ? ` · ${s.lesson_title}` : ""}</Text>
          <Text size={12} tone="muted" numberOfLines={1}>{where(s)}</Text>
        </View>
        {s.instructor_id ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 110 }}><Avatar name={x?.name ?? "?"} url={x?.avatar} size={28} /><Text size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{nameOf(s.instructor_id)}</Text></View>
          : lk ? <Badge>{s.status === "in_progress" ? "Live" : "Started"}</Badge>
          : <View style={{ borderRadius: 999, borderWidth: 1, borderStyle: "dashed", borderColor: p.a("warn", 0.6), paddingHorizontal: 10, paddingVertical: 4 }}><Text size={12} weight="medium" tone="warn">Assign</Text></View>}
      </Card>);
  };

  if (!ses && !loadErr) return <View style={{ gap: 12 }}><Skeleton height={32} style={{ width: "33%" }} /><Skeleton height={40} /><Skeleton height={96} /><Skeleton height={96} /></View>;
  const list = ses ?? [];
  return (
    <View style={{ gap: 16 }}>
      <Heading size={26} lh={32}>Roster</Heading>
      {loadErr ? <View style={{ gap: 8 }}><Err>{loadErr}</Err><Button variant="secondary" onPress={() => sq.refetch()}>Try again</Button></View> : null}
      {peopleErr ? <View style={{ gap: 8 }}><Err>{`Couldn't load instructors: ${peopleErr}`}</Err><Button variant="secondary" onPress={() => pq.refetch()}>Try again</Button></View> : null}

      {list.length === 0 && !loadErr ? <Card style={{ gap: 8, paddingVertical: 32, alignItems: "center" }}><Text weight="medium">No classes to staff yet</Text><Text size={14} tone="muted" align="center">Schedule a course run first. Its classes will appear here.</Text><Pressable accessibilityRole="link" onPress={() => router.push("/schedule")} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} weight="medium" tone="accent">Open schedule</Text></Pressable></Card> : <>
        {centres.length > 1 && <ChipRow><Chip on={!centre} onPress={() => setCentre("")}>All centres</Chip>{centres.map(([id, name]) => <Chip key={id} on={centre === id} onPress={() => setCentre(id)}>{name}</Chip>)}</ChipRow>}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}><Segmented value={view} onChange={setView} options={[{ value: "week", label: "By day" }, { value: "course", label: "By course" }]} /></View>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: gaps, disabled: !gaps && open === 0 }} disabled={!gaps && open === 0} onPress={() => setGaps(!gaps)}
            style={{ height: 48, borderRadius: 12, paddingHorizontal: 12, justifyContent: "center", opacity: !gaps && open === 0 ? 0.5 : 1, backgroundColor: gaps ? p.a("warn", 0.15) : p.c.surface, borderWidth: 1, borderColor: gaps ? p.a("warn", 0.4) : p.c.line }}>
            <Text size={14} weight={gaps ? "medium" : "regular"} tone={gaps ? "warn" : "ink"}>Needs instructor <Text size={14} num tone={gaps ? "warn" : "ink"}>{open}</Text></Text></Pressable>
        </View>

        {view === "week" && !gaps && week && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable accessibilityLabel="Previous week" onPress={() => setWeekSel(addDays(week, -7))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="chevronLeft" size={20} /></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setWeekSel(mondayOf(todayIso()))} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} weight="medium" num>{short(week)} – {short(addDays(week, 6))}</Text></Pressable>
            <Pressable accessibilityLabel="Next week" onPress={() => setWeekSel(addDays(week, 7))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="chevronRight" size={20} /></Pressable>
          </View>)}

        {view === "week" && (days.length === 0
          ? <Card style={{ paddingVertical: 32 }}><Text size={14} tone="muted" align="center">{gaps ? "Every upcoming class has an instructor." : "No classes this week."}</Text></Card>
          : <View style={{ gap: 16 }}>{days.map(([d, l]) => (
            <View key={d} style={{ gap: 8 }}>
              <Text size={14} weight="medium" tone="muted">{d === todayIso() ? "Today · " : ""}{label(d)}</Text>
              {l.map(row)}
            </View>))}</View>)}

        {view === "course" && (courses.length === 0
          ? <Card style={{ paddingVertical: 32 }}><Text size={14} tone="muted" align="center">{gaps ? "Every upcoming class has an instructor." : "No upcoming classes."}</Text></Card>
          : <View style={{ gap: 16 }}>{courses.map((c) => (
            <Card key={c.id} style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="semibold">{c.title}</Text><Text size={14} tone="muted">{c.groups.length === 1 ? "1 centre" : `${c.groups.length} centres`}</Text></View>
                {c.groups.length > 1 && <Pressable accessibilityRole="button" onPress={() => setEdit({ anchor: c.groups[0].list[0], scope: "all" })} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} weight="medium" tone="accent">Assign everywhere</Text></Pressable>}
              </View>
              {c.groups.map((g) => {
                const key = `${c.id}:${g.id}`, isOpen = expanded.has(key);
                const staff = new Map<string, number>(); g.list.forEach((s) => s.instructor_id && staff.set(s.instructor_id, (staff.get(s.instructor_id) ?? 0) + 1));
                const gap = g.list.filter((s) => !s.instructor_id).length;
                return (
                  <View key={g.id} style={{ gap: 8, borderRadius: 12, backgroundColor: p.c.sunken, padding: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <Pressable accessibilityRole="button" onPress={() => toggle(key)} style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{g.name}</Text><Text size={12} tone="muted" num>{short(g.list[0].session_date)} – {short(g.list[g.list.length - 1].session_date)} · {classes(g.list.length)}</Text></Pressable>
                      <Button variant="secondary" style={{ height: 36, paddingHorizontal: 12, backgroundColor: p.c.surface }} onPress={() => setEdit({ anchor: g.list[0], scope: "centre" })}>Assign all</Button>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 6 }}>
                      {[...staff].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
                        <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Avatar name={pmap.get(id)?.name ?? "?"} url={pmap.get(id)?.avatar} size={20} /><Text size={14}>{nameOf(id)} <Text size={14} tone="muted" num>{n}</Text></Text></View>))}
                      {gap > 0 ? <Badge tone="warn">{gap === 1 ? "1 needs an instructor" : `${gap} need an instructor`}</Badge> : <Badge tone="ok">Fully staffed</Badge>}
                    </View>
                    <Pressable accessibilityRole="button" onPress={() => toggle(key)} style={{ minHeight: 36, justifyContent: "center", alignSelf: "flex-start" }}><Text size={12} weight="medium" tone="accent">{isOpen ? "Hide classes" : "Show classes"}</Text></Pressable>
                    {isOpen && <View style={{ gap: 4 }}>{g.list.map((s) => (
                      <Pressable key={s.id} accessibilityRole="button" onPress={() => setEdit({ anchor: s, scope: "class" })} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 8, backgroundColor: p.c.surface, paddingHorizontal: 12, paddingVertical: 10 }}>
                        <Text size={14} numberOfLines={1} style={{ flex: 1 }}><Text size={14} tone="muted" num>{s.session_no}.</Text> {label(s.session_date)} · {clock(s.start_at)}</Text>
                        <Text size={14} tone={s.instructor_id ? "ink" : "warn"}>{s.instructor_id ? nameOf(s.instructor_id) : "Assign"}</Text>
                      </Pressable>))}</View>}
                  </View>);
              })}
            </Card>))}</View>)}
      </>}

      {edit && ses && <AssignSheet key={`${edit.anchor.id}:${edit.scope}`} anchor={edit.anchor} scope0={edit.scope} ses={ses} people={people} onClose={() => setEdit(null)} onSaved={() => sq.refetch()} />}
    </View>
  );
}
