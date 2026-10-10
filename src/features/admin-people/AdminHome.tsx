// Port of web pages/AdminHome.tsx. Overview numbers, the offline-payments nudge and the run reminder.
import { View } from "react-native";
import { naira } from "@/core/errors";
import { useRpc } from "@/data";
import RunReminder from "@/features/staff/RunReminder";
import { List, NavRow, PageHeader, Skeleton, Stat } from "@/ui";

 
export function AdminHome() {
  const oq = useRpc<any>("admin_overview", {}, { tags: ["payments", "enrolments", "sessions"], ttlMs: 60_000 });
  const fq = useRpc<{ open: number; with_receipt: number }>("offline_payment_counts", {}, { tags: ["payments"], ttlMs: 60_000 });
  const d = oq.data ?? (oq.error ? {} : undefined); const off = fq.data ?? { open: 0, with_receipt: 0 };
  if (!d) return <View style={{ gap: 16 }}><Skeleton height={32} style={{ width: "50%" }} /><Skeleton height={96} /><Skeleton height={96} /></View>;
  const st = d.enrolments_by_status ?? {};
  return (
    <View style={{ gap: 24 }}>
      <PageHeader title="Overview" />
      {off.open > 0 && <List><NavRow to="/offline-payments" icon="cash" tone="warn" title={`${off.open} offline ${off.open === 1 ? "payment" : "payments"} to review`} hint={`${off.with_receipt} with a receipt uploaded`} /></List>}
      <RunReminder />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {[
          { tone: "ok" as const, label: "Revenue this month", value: naira(d.revenue_this_month ?? 0) },
          { tone: "warn" as const, label: "Outstanding", value: naira(d.outstanding_balances ?? 0) },
          { tone: "info" as const, label: "Students", value: d.students_total ?? 0, sub: `${st.active ?? 0} active · ${st.pending_payment ?? 0} unpaid` },
          { label: "Classes today", value: d.sessions_today ?? 0 },
        ].map((s) => <View key={s.label} style={{ width: "47%", flexGrow: 1 }}><Stat {...s} /></View>)}
      </View>
      <Stat label="Owed to centres" value={naira(d.owed_to_centres ?? 0)} />
    </View>
  );
}
