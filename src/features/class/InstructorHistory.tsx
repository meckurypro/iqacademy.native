// Port of web pages/InstructorHistory.tsx. Classes the instructor has taught, newest first. The first page is cached (opens offline); "Load more" fetches older pages when online.
import { useState } from "react";
import { View } from "react-native";
import { friendly, ok } from "@/core/errors";
import { online, useQuery } from "@/data";
import { fmtWhen } from "@/shared/web/time";
import { Badge, Button, Card, Empty, Err, Heading, Place, Skeleton, Text } from "@/ui";

type H = { id: string; start_at: string; centre_name: string; centre_city: string | null; centre_address: string | null; course_title: string; lesson_title: string | null; students_present: number; students_enrolled: number; auto_closed: boolean };
const PAGE = 20; const COLS = "id,start_at,centre_name,centre_city,centre_address,course_title,lesson_title,students_present,students_enrolled,auto_closed";
type SB = Parameters<Parameters<typeof online>[0]>[0];
const page = async (sb: SB, from: number) => (ok(await sb.from("v_session_details").select(COLS).eq("status", "completed").order("start_at", { ascending: false }).range(from, from + PAGE - 1)) as H[]) ?? [];

export default function InstructorHistory() {
  const q = useQuery<H[]>({ key: ["teachingHistory"], tags: ["sessions", "attendance"], ttlMs: 60_000, fn: (sb) => page(sb, 0) });
  const [extra, setExtra] = useState<H[]>([]); const [more, setMore] = useState<boolean | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const first = q.data; const rows = first ? [...first, ...extra.filter((x) => !first.some((f) => f.id === x.id))] : undefined;
  const hasMore = more ?? (first?.length === PAGE);

  const load = async () => {
    if (!rows) return; setBusy(true); setErr("");
    try { const next = await online((sb) => page(sb, rows.length)); setExtra((e) => [...e, ...next]); setMore(next.length === PAGE); }
    catch (e) { setErr(friendly(e)); } finally { setBusy(false); }
  };

  if (q.error && !rows) return <Empty icon="alert" title="Couldn't load your history" hint="Check your connection and try again." />;
  return (
    <View style={{ gap: 16 }}>
      <Heading size={26} lh={32}>Teaching history</Heading>
      {!rows ? <><Skeleton height={80} /><Skeleton height={80} /></> : rows.length === 0 ? <Empty title="Classes you teach will appear here." /> : rows.map((r) => (
        <Card key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text weight="medium" numberOfLines={1}>{r.course_title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}><Text size={14} tone="muted">{`${fmtWhen(r.start_at, { weekday: "short", day: "numeric", month: "short" })} · `}</Text><Place centre={{ name: r.centre_name, city: r.centre_city, address: r.centre_address }} nameOnly size={14} tone="muted" /></View>
            {r.auto_closed && <View style={{ alignSelf: "flex-start" }}><Badge tone="warn">Auto-closed</Badge></View>}
          </View>
          <View style={{ alignItems: "flex-end" }}><Text size={20} weight="semibold" num>{r.students_present}</Text><Text size={12} tone="muted">of {r.students_enrolled}</Text></View>
        </Card>))}
      <Err>{err}</Err>
      {rows && rows.length > 0 && hasMore && <Button variant="secondary" loading={busy} onPress={load}>Load more</Button>}
    </View>
  );
}
