// Port of web pages/Statement.tsx. Line-by-line record of a month: the page to open when a figure needs checking. Payment references only, never student names.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { friendly, naira } from "@/core/errors";
import { useRpc } from "@/data";
import { place } from "@/shared/web/centre";
import { fmtDay, fmtWhen } from "@/shared/web/time";
import { Badge, Card, Chip, ChipRow, Empty, Err, List, PageHeader, Section, Skeleton, Stat, Text } from "@/ui";
import { useStaffCentres } from "./useStaffCentres";

type Line = { entry_type: string; amount: number | string; created_at: string; description: string; base_amount: number | string | null; share_pct: number | string | null };
type St = { lines?: Line[]; closed?: { created_at: string; entry_count: number; closing_balance: number; checksum: string } | null };
const KIND: Record<string, string> = { earning: "Your share", refund_reversal: "Refund deducted", adjustment: "Adjustment", payout: "Withdrawal paid", payout_reversal: "Withdrawal returned" };
const monthLabel = (m: string) => fmtDay(m, { month: "long", year: "numeric" });

export default function Statement() {
  const { ids, centres } = useStaffCentres();
  const [cid, setCid] = useState(""); const [monthSel, setMonthSel] = useState("");
  const centre = cid || ids[0] || "";
  const mq = useRpc<{ months?: { month: string }[] }>("centre_income_months", { p_centre_id: centre }, { enabled: !!centre, tags: ["income", "payments"] });
  const months = mq.data ? (mq.data.months ?? []).map((m) => m.month) : undefined;
  const month = months ? (months.includes(monthSel) ? monthSel : months[0] ?? "") : "";
  const sq = useRpc<St>("centre_statement", { p_centre_id: centre, p_month: month }, { enabled: !!centre && !!month, tags: ["income", "payments"] });
  const st = sq.data; const err = mq.error ? friendly(mq.error) : sq.error ? friendly(sq.error) : "";

  const sum = useMemo(() => {
    const L = st?.lines ?? []; const by = (...k: string[]) => L.filter((l) => k.includes(l.entry_type)).reduce((n, l) => n + Number(l.amount), 0);
    return { earned: by("earning"), refunds: -by("refund_reversal"), paid: -by("payout", "payout_reversal"), balance: L.reduce((n, l) => n + Number(l.amount), 0) };
  }, [st]);
  const waiting = !months || (!!month && !st && !sq.error);

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Statements" sub="Every payment and deduction behind your balance" />
      {ids.length > 1 && <ChipRow>{(centres ?? []).map((c) => <Chip key={c.id} on={centre === c.id} onPress={() => { setCid(c.id); setMonthSel(""); }}>{place(c)}</Chip>)}</ChipRow>}
      {months && months.length > 1 && <ChipRow>{months.map((m) => <Chip key={m} on={month === m} onPress={() => setMonthSel(m)}>{monthLabel(m)}</Chip>)}</ChipRow>}
      <Err>{err}</Err>
      {waiting && !err ? <View style={{ gap: 12 }}><Skeleton height={96} /><Skeleton height={160} /></View>
        : months && months.length === 0 ? <Empty icon="receipt" title="No statements yet." hint="A month appears here once there is income or a deduction to show." />
        : !st ? null : <>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {[{ tone: "ok" as const, label: "Your share", value: naira(sum.earned) }, { tone: "bad" as const, label: "Refunds deducted", value: sum.refunds ? "−" + naira(sum.refunds) : naira(0) }, { label: "Withdrawn", value: naira(sum.paid) }, { tone: "info" as const, label: "Balance", value: naira(sum.balance) }]
            .map((s) => <View key={s.label} style={{ width: "48%", flexGrow: 1 }}><Stat compact {...s} /></View>)}
        </View>
        {st.closed
          ? <Card style={{ gap: 4, padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text weight="medium">Month closed</Text><Badge tone="ok">Frozen</Badge></View>
              <Text size={13} tone="muted">Closed {fmtWhen(st.closed.created_at, { dateStyle: "medium" })} with {st.closed.entry_count} entries and a closing balance of {naira(st.closed.closing_balance)}. Reference {String(st.closed.checksum).slice(0, 10)}. Raise any question about this month within 7 days of month end.</Text>
            </Card>
          : <Text size={13} tone="muted">This month is still open. It is frozen automatically on the 1st.</Text>}
        <Section title="Line by line" aside={<Text size={14} tone="muted" num>{(st.lines ?? []).length}</Text>}>
          {(st.lines ?? []).length === 0 ? <Empty icon="receipt" title="No entries this month." /> : <List>{(st.lines ?? []).map((l, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="medium" numberOfLines={1}>{KIND[l.entry_type] ?? l.entry_type}</Text>
                <Text size={13} tone="muted">{fmtWhen(l.created_at, { dateStyle: "medium" })} · {l.description}</Text>
                {l.base_amount != null && l.share_pct != null && <Text size={12} tone="muted">{Number(l.share_pct)}% of {naira(Math.abs(Number(l.base_amount)))}</Text>}
              </View>
              <Text weight="semibold" num tone={Number(l.amount) < 0 ? "bad" : "ink"}>{Number(l.amount) < 0 ? "−" : ""}{naira(Math.abs(Number(l.amount)))}</Text>
            </View>))}</List>}
        </Section>
      </>}
    </View>
  );
}
