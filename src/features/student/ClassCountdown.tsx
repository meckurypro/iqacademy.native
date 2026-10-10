// src/features/student/ClassCountdown.tsx
// Port of web components/ClassCountdown.tsx @d14323f: the "next class" card for students, instructors and coordinators.
//   > 1 day away: days and hours · under a day: hours, minutes, seconds · check-in open: countdown to the start with the door shown as open
//   live: how long is left; the moment it ends, the countdown to the following class begins.
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { CHECKIN_OPENS_MIN } from "@/shared/checkin";
import { phaseOf, spoken, splitMs, type ClockClass } from "@/shared/classClock";
import { fmtClock, fmtWhen, relativeDay } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Card, Icon, Place, Skeleton, Text } from "@/ui";
import { useCheckedIn, useClassClock } from "./hooks";

const two = (n: number) => String(n).padStart(2, "0");

function Unit({ value, label }: { value: string; label: string }) {
  const { p } = useTheme();
  return (
    <View style={{ minWidth: 58, borderRadius: 12, backgroundColor: p.a("sunken", 0.8), paddingHorizontal: 8, paddingVertical: 10, alignItems: "center" }}>
      <Text size={28} weight="semibold" tracking={-0.025} lh={28} num>{value}</Text>
      <Text size={10} weight="medium" tone="muted" upper tracking={0.05} lh={12} style={{ marginTop: 6 }}>{label}</Text>
    </View>
  );
}

function Digits({ ms }: { ms: number }) {
  const { d, h, m, s } = splitMs(ms);
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }} importantForAccessibility="no-hide-descendants">
      {d > 0 ? <><Unit value={String(d)} label={d === 1 ? "day" : "days"} /><Unit value={two(h)} label="hrs" /><Unit value={two(m)} label="min" /></>
        : h > 0 ? <><Unit value={String(h)} label="hrs" /><Unit value={two(m)} label="min" /><Unit value={two(s)} label="sec" /></>
        : <><Unit value={two(m)} label="min" /><Unit value={two(s)} label="sec" /></>}
    </View>
  );
}

const opensClock = (c: ClockClass) => fmtClock(Date.parse(c.start_at) - CHECKIN_OPENS_MIN * 60000);
const roleCopy = {
  student: { early: (c: ClockClass) => `Check-in opens at ${opensClock(c)}`, open: "Check in" },
  instructor: { early: () => "", open: "Open class" },
  staff: { early: (c: ClockClass) => `Class code appears at ${opensClock(c)}`, open: "Open class code" },
} as const;

export default function ClassCountdown({ onCheckIn, student }: { onCheckIn?: (c: ClockClass) => void; student?: boolean }) {
  const { p } = useTheme(); const router = useRouter();
  const { loading, current: c, next, now } = useClassClock(3, !!student);
  const checkedIn = useCheckedIn(c?.id, c?.as_role === "student");
  if (loading) return <Skeleton height={192} style={{ borderRadius: 16 }} />;
  if (!c) return null; // nothing coming up: the rest of the dashboard speaks for itself

  const phase = phaseOf(c, now);
  const start = Date.parse(c.start_at), end = Date.parse(c.end_at);
  const toStart = start - now, toEnd = end - now;
  const copy = roleCopy[c.as_role];
  const doorOpen = phase === "checkin" || phase === "live";
  // Whoever runs the door gets the class code and QR on the class screen, so say so.
  const showsCode = doorOpen && (c.as_role === "staff" || (c.as_role === "instructor" && c.is_emergency));
  const label = phase === "live" ? "In progress" : phase === "checkin" ? "Check-in is open" : `Next class · ${relativeDay(c.start_at, { weekday: "long", day: "numeric", month: "short" })}`;
  const progress = phase === "live" ? (now - start) / Math.max(end - start, 1) : phase === "checkin" ? 1 - toStart / (CHECKIN_OPENS_MIN * 60000) : 0;
  const sr = phase === "live" ? `Class in progress, ${spoken(toEnd)} left` : `Class starts in ${spoken(toStart)}`;
  const go = (href: string) => router.push(href as Href);

  const action = c.as_role === "student"
    ? (checkedIn
      ? <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, backgroundColor: p.a("ok", 0.1), paddingHorizontal: 12, paddingVertical: 12 }}>
            <Icon name="check" size={16} color={p.c.ok} /><Text size={14} weight="medium" tone="ok">{"You're checked in"}</Text>
          </View>
          <Button variant="secondary" onPress={() => go(`/messages/${c.id}`)}>Class messages</Button>
        </View>
      : doorOpen
        ? <Button onPress={() => onCheckIn?.(c)} style={{ height: 48 }}>Check in</Button>
        : <View style={{ borderRadius: 12, backgroundColor: p.a("sunken", 0.8), paddingHorizontal: 12, paddingVertical: 12 }}><Text size={14} weight="medium" align="center">{copy.early(c)}</Text></View>)
    : (doorOpen
      ? <Button onPress={() => go(`/class/${c.id}${showsCode ? "?reveal=1" : ""}`)} style={{ height: 48 }}>{showsCode ? "Reveal code" : copy.open}</Button>
      : <Button variant="secondary" onPress={() => go(`/class/${c.id}`)}>{copy.early(c) || "View class"}</Button>);

  return (
    <Card style={{ gap: 16, padding: 20, overflow: "hidden" }}>
      <LinearGradient pointerEvents="none" colors={[p.a("accent", 0.08), "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          {phase === "live" && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.c.ok }} />}
          <Text size={14} weight="medium" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{label}{c.is_emergency ? " · Custom" : ""}</Text>
        </View>
        {phase === "checkin" && !checkedIn && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: p.a("ok", 0.1), paddingHorizontal: 10, paddingVertical: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.c.ok }} /><Text size={12} weight="medium" tone="ok">Door open</Text>
          </View>
        )}
      </View>

      <View accessibilityRole="timer" accessible accessibilityLabel={sr} style={{ gap: 8 }}>
        <Text size={14} tone="muted">{phase === "live" ? "Ends in" : "Starts in"}</Text>
        <Digits ms={phase === "live" ? toEnd : toStart} />
      </View>

      {doorOpen && (
        <View importantForAccessibility="no-hide-descendants" style={{ height: 6, overflow: "hidden", borderRadius: 3, backgroundColor: p.c.sunken }}>
          <View style={{ height: "100%", borderRadius: 3, backgroundColor: p.c.accent, width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        </View>
      )}

      <View>
        <Text size={20} weight="semibold" tracking={-0.025} lh={28}>{c.course_title}</Text>
        {!!c.lesson_title && <Text tone="muted">{c.lesson_title}</Text>}
        <View style={{ marginTop: 4, flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
          <Text size={14} tone="muted">{fmtClock(c.start_at)} – {fmtClock(c.end_at)} · </Text>
          <Place centre={{ name: c.centre_name, city: c.centre_city, address: c.centre_address }} size={14} tone="muted" />
          {!!c.room && <Text size={14} tone="muted">{` · ${c.room}`}</Text>}
        </View>
        {c.as_role !== "instructor" && !!c.instructor_name && <Text size={14} tone="muted">With {c.instructor_name}</Text>}
      </View>

      {action}

      {next && (
        <View style={{ borderTopWidth: 1, borderTopColor: p.c.line, paddingTop: 12 }}>
          <Text size={14} tone="muted">Then: {next.course_title} · {fmtWhen(next.start_at, { weekday: "short", day: "numeric", month: "short" })}, {fmtClock(next.start_at)}</Text>
        </View>
      )}
    </Card>
  );
}
