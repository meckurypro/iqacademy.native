// Port of web pages/CustomClasses.tsx. Create a class, choose who is invited, and see the ones that are coming up or recently held.
// Admins see every custom class and choose the instructor; instructors see and create their own. An instructor can change a class and its invitations
// until 30 minutes before it starts; the database enforces that (app_settings.custom_class_edit_lock_minutes), this page only hides Edit once it has passed.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { useRpc } from "@/data";
import { useTicker } from "@/shared/useTicker";
import { fmtClock, fmtWhen, now as clockNow } from "@/shared/web/time";
import { Badge, Button, Card, Empty, PageHeader, Place, Section, Skeleton, Text } from "@/ui";
import CustomClassSheet, { type CustomClassRow } from "./CustomClassSheet";

/** Matches app_settings.custom_class_edit_lock_minutes. */
const EDIT_LOCK_MIN = 30;
const when = (d: string) => fmtWhen(d, { weekday: "short", day: "numeric", month: "short" }) + " · " + fmtClock(d);
const tone = { in_progress: "warn", scheduled: "muted", completed: "ok", cancelled: "bad" } as const;
const text = { in_progress: "Live", scheduled: "Scheduled", completed: "Held", cancelled: "Cancelled" } as const;

export default function CustomClasses() {
  const { roles } = useAuth(); const router = useRouter(); useTicker(30_000);
  const admin = roles.some((r) => r.role === "admin" || r.role === "super_admin");
  const [sheet, setSheet] = useState<null | "new" | CustomClassRow>(null);
  const q = useRpc<CustomClassRow[]>("custom_classes_overview", {}, { tags: ["sessions"], ttlMs: 30_000 });
  const rows = q.data; const failed = !!q.error && !rows;

  const now = clockNow();
  const current = (rows ?? []).filter((s) => (s.status === "scheduled" || s.status === "in_progress") && Date.parse(s.end_at) >= now).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  const past = (rows ?? []).filter((s) => !current.includes(s));
  // the server decides; the clock only hides the button once the cut-off has passed while this page is open
  const editable = (s: CustomClassRow) => s.can_edit && (admin || now <= Date.parse(s.start_at) - EDIT_LOCK_MIN * 60000);

  const item = (s: CustomClassRow) => (
    <Card key={s.id} style={{ gap: 8 }}>
      <Pressable accessibilityRole="link" onPress={() => router.push(`/class/${s.id}`)} style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <Text weight="medium" style={{ flex: 1 }}>{s.course_title}</Text>
          <Badge tone={tone[s.status as keyof typeof tone] ?? "muted"}>{text[s.status as keyof typeof text] ?? s.status}</Badge>
        </View>
        {s.lesson_title ? <Text size={14} tone="muted">{s.lesson_title}</Text> : null}
        <Text size={14} num>{when(s.start_at)}</Text>
        <Text size={14} tone="muted"><Place centre={{ name: s.centre_name, city: s.centre_city, address: s.centre_address }} nameOnly size={14} tone="muted" />{admin && s.instructor_name ? ` · ${s.instructor_name}` : ""}</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text size={14} tone="muted" num style={{ flex: 1 }}>{s.students_invited} {s.students_invited === 1 ? "student" : "students"} invited{s.status === "completed" ? ` · ${s.students_present} attended` : ""}</Text>
        {editable(s) && <Button variant="secondary" style={{ height: 36, paddingHorizontal: 14 }} onPress={() => setSheet(s)}>Edit</Button>}
      </View>
    </Card>);

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Custom classes" />
      <Button onPress={() => setSheet("new")}>New custom class</Button>
      {!rows && !failed ? <View style={{ gap: 12 }}><Skeleton height={96} /><Skeleton height={96} /></View>
        : failed ? <Card style={{ gap: 4, alignItems: "center" }}><Text size={14} tone="muted">{"Couldn't load custom classes."}</Text><Pressable accessibilityRole="button" onPress={() => q.refetch()} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} weight="medium" tone="accent">Try again</Text></Pressable></Card>
        : <>
          <Section title="Coming up">{current.length === 0 ? <Empty icon="calendarPlus" title="No custom classes coming up" /> : <View style={{ gap: 12 }}>{current.map(item)}</View>}</Section>
          {past.length > 0 && <Section title="Recent"><View style={{ gap: 12 }}>{past.map(item)}</View></Section>}
        </>}
      {sheet && <CustomClassSheet key={sheet === "new" ? "new" : sheet.id} admin={admin} edit={sheet === "new" ? undefined : sheet} onClose={() => setSheet(null)} onSaved={() => q.refetch()} />}
    </View>
  );
}
