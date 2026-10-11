// Port of web pages/MyClasses.tsx. What an instructor teaches: the classes an admin assigned, with topic, time and venue. Cached, and refreshed when the roster changes
// ("sessions" tag) or a notice arrives ("notifications" tag), so a new assignment appears without pulling to refresh.
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useRpc } from "@/data";
import { dayOf, fmtClock, fmtWhen, relativeDay, today } from "@/shared/web/time";
import { Badge, Card, Heading, Place, Skeleton, Text } from "@/ui";

type C = {
  id: string; session_no: number; start_at: string; end_at: string; status: string; course_id: string; course_title: string; total_sessions: number; lesson_title: string | null;
  centre_id: string; centre_name: string; centre_city: string | null; centre_address: string | null; is_emergency?: boolean;
};
const short = (d: string) => fmtWhen(d, { day: "numeric", month: "short" });
const dayLabel = (d: string) => relativeDay(d, { weekday: "long", day: "numeric", month: "short" });
const centreOf = (c: C) => ({ name: c.centre_name, city: c.centre_city, address: c.centre_address });

export default function MyClasses() {
  const router = useRouter();
  const q = useRpc<C[]>("my_classes", {}, { tags: ["sessions", "notifications"], ttlMs: 60_000 });
  const rows = q.data; const failed = !!q.error && !rows;

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; title: string; centre: C; n: number; first: string; last: string }>();
    (rows ?? []).forEach((c) => {
      const k = `${c.course_id}:${c.centre_id}`; const g = m.get(k);
      if (!g) m.set(k, { key: k, title: c.course_title, centre: c, n: 1, first: c.start_at, last: c.start_at }); else { g.n++; if (c.start_at > g.last) g.last = c.start_at; }
    });
    return [...m.values()];
  }, [rows]);
  const days = useMemo(() => {
    const m = new Map<string, C[]>();
    (rows ?? []).forEach((c) => m.set(dayOf(c.start_at), [...(m.get(dayOf(c.start_at)) ?? []), c]));
    return [...m.values()];
  }, [rows]);

  return (
    <View style={{ gap: 20 }}>
      <Heading size={26} lh={32}>My classes</Heading>
      {!rows && !failed ? <View style={{ gap: 12 }}><Skeleton height={96} /><Skeleton height={112} /><Skeleton height={112} /></View>
        : failed ? <Card style={{ gap: 4, alignItems: "center" }}><Text size={14} tone="muted">{"Couldn't load your classes."}</Text><Pressable accessibilityRole="button" onPress={() => q.refetch()} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} weight="medium" tone="accent">Try again</Text></Pressable></Card>
        : rows!.length === 0 ? <Card style={{ gap: 4, alignItems: "center", paddingVertical: 32 }}><Text weight="medium">Nothing assigned yet</Text><Text size={14} tone="muted" align="center">{"When an admin assigns you classes you'll be notified, and they'll show up here."}</Text></Card>
        : <>
          <View style={{ gap: 8 }}>
            <Heading size={18}>You teach</Heading>
            <Card style={{ paddingVertical: 4 }}>{groups.map((g, i) => (
              <View key={g.key} style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: "rgba(128,128,128,.2)" }}>
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{g.title}</Text><Place centre={centreOf(g.centre)} size={14} tone="muted" /></View>
                <View style={{ alignItems: "flex-end" }}><Text size={14} weight="medium" num>{g.n} {g.n === 1 ? "class" : "classes"}</Text><Text size={12} tone="muted" num>{g.n > 1 ? `${short(g.first)} to ${short(g.last)}` : short(g.first)}</Text></View>
              </View>))}</Card>
          </View>
          <View style={{ gap: 16 }}>
            <Heading size={18}>Coming up</Heading>
            {days.map((list) => (
              <View key={dayOf(list[0].start_at)} style={{ gap: 8 }}>
                <Text size={14} weight="medium" tone="muted">{dayLabel(list[0].start_at)}</Text>
                {list.map((c) => {
                  const live = c.status === "in_progress"; const openable = live || dayOf(c.start_at) === today();
                  return (
                    <Card key={c.id} onPress={openable ? () => router.push(`/class/${c.id}`) : undefined} style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <Text weight="medium" style={{ flex: 1 }}>{c.course_title}</Text>
                        <View style={{ flexDirection: "row", gap: 4 }}>{c.is_emergency && <Badge tone="info">Custom</Badge>}{live ? <Badge tone="warn">Live</Badge> : openable ? <Badge tone="ok">Today</Badge> : null}</View>
                      </View>
                      <Text size={14} tone="muted">{c.is_emergency ? "Custom class" : `Class ${c.session_no} of ${c.total_sessions}`}{c.lesson_title ? ` · ${c.lesson_title}` : ""}</Text>
                      <Text size={14} num>{fmtClock(c.start_at)} – {fmtClock(c.end_at)}</Text>
                      <Place centre={centreOf(c)} size={14} tone="muted" />
                    </Card>);
                })}
              </View>))}
          </View>
        </>}
    </View>
  );
}
