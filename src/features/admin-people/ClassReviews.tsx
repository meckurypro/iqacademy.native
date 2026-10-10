// Port of web pages/ClassReviews.tsx — admin: what students said about their classes. Read every review, see who reported an instructor, and choose up to ten
// reviews to show on the landing page. Showing/hiding is online-only (the server enforces the ten-review limit and the rules below).
import { useMemo, useState } from "react";
import { Switch, View } from "react-native";
import { useRpc, mutate } from "@/data";
import { fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Badge, Card, Chip, ChipRow, Empty, Icon, PageHeader, Skeleton, Stars, Text, useFeedback } from "@/ui";

export const FEATURE_LIMIT = 10;
export type AdminReview = {
  id: string; session_id: string; rating: number; comment: string | null; report_instructor: boolean; report_reason: string | null; featured: boolean; created_at: string;
  student_name: string; student_avatar: string | null; instructor_name: string | null; course_title: string | null; centre_name: string | null; session_date: string | null;
};
type Filter = "all" | "reported" | "featured" | "low";
const FILTERS: [Filter, string][] = [["all", "All"], ["reported", "Reported"], ["featured", "On landing page"], ["low", "1–2 stars"]];
const when = (d: string) => fmtWhen(d, { day: "numeric", month: "short", year: "numeric" });

export default function ClassReviews() {
  const { p } = useTheme(); const { run } = useFeedback();
  const [filter, setFilter] = useState<Filter>("all");
  const q = useRpc<AdminReview[]>("admin_class_reviews", {}, { tags: ["reviews"], ttlMs: 30_000 });
  const rows = q.data;
  const featured = rows?.filter((r) => r.featured).length ?? 0; const reported = rows?.filter((r) => r.report_instructor).length ?? 0;
  const avg = useMemo(() => (rows?.length ? rows.reduce((n, r) => n + r.rating, 0) / rows.length : 0), [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => filter === "all" ? true : filter === "reported" ? r.report_instructor : filter === "featured" ? r.featured : r.rating <= 2), [rows, filter]);

  const toggle = (r: AdminReview) => run(r.featured ? "Hiding review…" : "Showing review…", async () => {
    await mutate.rpc("set_review_featured", { p_id: r.id, p_featured: !r.featured }, { invalidates: ["reviews"] }); await q.refetch();
  });

  if (q.error && !rows) return <Empty icon="alert" title="Couldn't load reviews" hint="Check your connection and try again." />;
  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Class reviews" sub={rows ? (rows.length ? `${rows.length} review${rows.length === 1 ? "" : "s"} · ${avg.toFixed(1)} average` : "Students review a class after it ends") : undefined} />
      <Card variant="glass" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: p.a("accent", 0.1) }}><Icon name="star" size={22} solid color={p.c.accent} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">On the landing page</Text><Text size={14} tone="muted">Visitors swipe through these. Choose up to {FEATURE_LIMIT}.</Text></View>
        <Text size={24} weight="semibold" num>{featured}<Text size={16} weight="medium" tone="muted">/{FEATURE_LIMIT}</Text></Text>
      </Card>
      <ChipRow>{FILTERS.map(([k, label]) => <Chip key={k} on={filter === k} onPress={() => setFilter(k)}>{k === "reported" && reported > 0 ? `${label} · ${reported}` : label}</Chip>)}</ChipRow>
      {!rows ? <View style={{ gap: 12 }}><Skeleton height={144} /><Skeleton height={144} /></View>
        : shown.length === 0 ? <Empty icon="star" title={rows.length ? "Nothing here" : "No reviews yet"} hint={rows.length ? "No review matches this filter." : "Reviews appear here when students rate a class that has ended."} />
        : <View style={{ gap: 12 }}>{shown.map((r) => {
          const noText = (r.comment ?? "").trim().length < 10;
          const blocked = r.report_instructor ? "A review that reports an instructor is never shown publicly." : noText ? "Only a review with a written comment can be shown." : !r.featured && featured >= FEATURE_LIMIT ? `Already ${FEATURE_LIMIT} on the landing page. Hide one to add this.` : "";
          return (
            <Card key={r.id} style={{ gap: 12, ...(r.report_instructor ? { borderColor: p.a("bad", 0.3) } : null) }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Avatar name={r.student_name} url={r.student_avatar} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="semibold" numberOfLines={1}>{r.student_name}</Text><Text size={12} tone="muted">{when(r.created_at)}</Text></View>
                <Stars value={r.rating} size={16} />
              </View>
              <Text size={14} tone="muted">{[r.course_title, r.instructor_name && `Instructor ${r.instructor_name}`, r.centre_name].filter(Boolean).join(" · ")}</Text>
              {r.comment ? <Text selectable>{r.comment}</Text> : <Text size={14} tone="muted" style={{ fontStyle: "italic" }}>No written comment.</Text>}
              {r.report_instructor && <View style={{ borderRadius: 12, backgroundColor: p.a("bad", 0.1), padding: 12, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="flag" size={15} color={p.c.bad} /><Text size={14} weight="medium" tone="bad">Reported {r.instructor_name ? r.instructor_name : "the instructor"}</Text></View>
                <Text size={14} selectable>{r.report_reason}</Text></View>}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: p.c.line, paddingTop: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}><Text size={14} weight="medium">Show on landing page</Text>{blocked ? <Text size={12} tone="muted">{blocked}</Text> : null}</View>
                {r.featured && <Badge tone="ok">Showing</Badge>}
                <Switch accessibilityLabel="Show on landing page" value={r.featured} disabled={!r.featured && !!blocked} onValueChange={() => { void toggle(r); }} trackColor={{ false: p.c.line, true: p.c.accent }} thumbColor="#fff" />
              </View>
            </Card>);
        })}</View>}
    </View>
  );
}
