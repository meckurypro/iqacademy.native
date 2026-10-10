// Port of web pages/HandCheckIns.tsx — admin: every time someone was checked in by hand. Shows who did it and how (the student's PIN, or an admin's written reason),
// and which ones the student disputed, so misuse stands out. Read-only.
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRpc } from "@/data";
import { fmtClock, fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Badge, Card, Chip, ChipRow, Empty, PageHeader, Skeleton, Text } from "@/ui";

type Row = { id: string; created_at: string; marker_id: string | null; marker_name: string; student_name: string; course_title: string | null; session_date: string | null; centre_name: string | null; method: "pin" | "admin_override"; override_reason: string | null; disputed: boolean };
const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"]] as const;

export default function HandCheckIns() {
  const { p } = useTheme();
  const [days, setDays] = useState<number>(30); const [who, setWho] = useState<string | null>(null); const [only, setOnly] = useState<"all" | "disputed" | "override">("all");
  const q = useRpc<Row[]>("admin_hand_check_ins", { p_days: days }, { tags: ["checkins", "attendance"], ttlMs: 60_000 });
  const rows = q.data ?? null;

  const staff = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number; overrides: number; disputed: number }>();
    for (const r of rows ?? []) {
      const k = r.marker_id ?? "none"; const e = m.get(k) ?? { id: k, name: r.marker_name, total: 0, overrides: 0, disputed: 0 };
      e.total++; if (r.method === "admin_override") e.overrides++; if (r.disputed) e.disputed++; m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.disputed - a.disputed || b.total - a.total);
  }, [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => (!who || (r.marker_id ?? "none") === who) && (only === "all" || (only === "disputed" ? r.disputed : r.method === "admin_override"))), [rows, who, only]);
  const disputed = rows?.filter((r) => r.disputed).length ?? 0; const overrides = rows?.filter((r) => r.method === "admin_override").length ?? 0;

  if (q.error && !rows) return <Empty icon="alert" title="Couldn't load hand check-ins" hint="Check your connection and try again." />;
  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Hand check-ins" sub="Students checked in without scanning. Each needs the student's PIN, or an admin's written reason." />
      <ChipRow>{RANGES.map(([d, label]) => <Chip key={d} on={days === d} onPress={() => setDays(d)}>{`Last ${label}`}</Chip>)}</ChipRow>
      {rows === null ? <View style={{ gap: 12 }}><Skeleton height={96} /><Skeleton height={128} /></View> : <>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {([["Total", rows.length, "ink", "all"], ["Admin overrides", overrides, "warn", "override"], ["Disputed", disputed, "bad", "disputed"]] as const).map(([label, n, tone, f]) => (
            <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: only === f }} onPress={() => setOnly(only === f ? "all" : f)}
              style={{ flex: 1, borderRadius: 16, backgroundColor: p.c.surface, padding: 14, borderWidth: only === f && f !== "all" ? 2 : 1, borderColor: only === f && f !== "all" ? p.c.accent : p.c.line }}>
              <Text size={24} weight="semibold" num tone={n > 0 ? tone : "muted"}>{n}</Text><Text size={12} tone="muted">{label}</Text></Pressable>))}
        </View>

        {staff.length > 0 && <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}><Text size={14} weight="semibold" tone="muted">By person</Text>{who && <Pressable accessibilityRole="button" onPress={() => setWho(null)} style={{ marginLeft: 8, minHeight: 36, justifyContent: "center" }}><Text size={14} weight="medium" tone="accent">Show everyone</Text></Pressable>}</View>
          {staff.map((s) => (
            <Card key={s.id} onPress={() => setWho(who === s.id ? null : s.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, ...(who === s.id ? { borderColor: p.c.accent, borderWidth: 2 } : null) }}>
              <Avatar name={s.name} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{s.name}</Text><Text size={12} tone="muted">{s.total} check-in{s.total === 1 ? "" : "s"}{s.overrides ? ` · ${s.overrides} override${s.overrides === 1 ? "" : "s"}` : ""}</Text></View>
              {s.disputed > 0 && <Badge tone="bad">{s.disputed} disputed</Badge>}
            </Card>))}
        </View>}

        {shown.length === 0 ? <Empty icon="checkCircle" title={rows.length ? "Nothing matches" : "No hand check-ins"} hint={rows.length ? "Try another filter." : "Everyone in this period scanned the class code."} />
          : <View style={{ gap: 8 }}>
            <Text size={14} weight="semibold" tone="muted" style={{ paddingHorizontal: 4 }}>Check-ins</Text>
            {shown.map((r) => (
              <Card key={r.id} style={{ gap: 6, ...(r.disputed ? { borderColor: p.a("bad", 0.3) } : null) }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{r.student_name}</Text><Text size={14} tone="muted" numberOfLines={1}>{[r.course_title, r.centre_name].filter(Boolean).join(" · ")}</Text></View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>{r.disputed && <Badge tone="bad">Disputed</Badge>}<Badge tone={r.method === "pin" ? "ok" : "warn"}>{r.method === "pin" ? "PIN" : "Admin override"}</Badge></View>
                </View>
                <Text size={12} tone="muted">By {r.marker_name} · {fmtWhen(r.created_at, { day: "numeric", month: "short" })}, {fmtClock(r.created_at)}</Text>
                {r.override_reason ? <Text size={14} style={{ borderRadius: 12, backgroundColor: p.c.sunken, paddingHorizontal: 12, paddingVertical: 8 }}>{r.override_reason}</Text> : null}
              </Card>))}
          </View>}
      </>}
    </View>
  );
}
