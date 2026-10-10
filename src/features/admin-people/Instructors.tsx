// Port of web pages/Instructors.tsx. What each instructor taught between two dates.
import { useState } from "react";
import { View } from "react-native";
import { useRpc } from "@/data";
import { monthStart, today } from "@/shared/web/time";
import { Avatar, Card, DateField, Empty, Heading, Skeleton, Text } from "@/ui";

 
export default function Instructors() {
  const [from, setFrom] = useState(monthStart(today())); const [to, setTo] = useState(today());
  const q = useRpc<any[]>("admin_instructor_summary", { p_from: from, p_to: to }, { enabled: !!from && !!to, tags: ["attendance", "sessions"], ttlMs: 60_000 });
  const rows = q.data;
  return (
    <View style={{ gap: 16 }}>
      <Heading size={26} lh={32}>Instructors</Heading>
      <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><DateField label="From" value={from} max={to || undefined} onChange={setFrom} /></View><View style={{ flex: 1 }}><DateField label="To" value={to} min={from || undefined} onChange={setTo} /></View></View>
      {!rows ? <Skeleton height={96} /> : rows.length === 0 ? <Empty title="No instructors yet. Promote someone on the Users page." /> : <View style={{ gap: 12 }}>{rows.map((r) => (
        <Card key={r.instructor_id} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Avatar name={r.full_name} size={40} /><View><Text weight="medium">{r.full_name}</Text><Text size={12} tone="muted" style={{ textTransform: "capitalize" }}>{String(r.pay_model).replace("_", " ")}</Text></View></View>
          <View style={{ flexDirection: "row" }}>
            {[[r.sessions_taught, "classes"], [r.student_attendances, "students taught"], [r.avg_students_per_class, "avg / class"]].map(([v, l]) => <View key={String(l)} style={{ flex: 1, alignItems: "center" }}><Text size={20} weight="semibold" num>{v}</Text><Text size={12} tone="muted">{l}</Text></View>)}
          </View>
        </Card>))}</View>}
    </View>
  );
}
