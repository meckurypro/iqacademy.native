// Port of web pages/DirectorHome.tsx (overview and income). One account, any number of branches: pick a branch, or see them all together.
// Withdrawals are requests the admin approves: online-only, confirmed first, and they are money, so they never queue.
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useAuth } from "@/core/auth";
import { naira } from "@/core/errors";
import { mutate } from "@/data";
import { place } from "@/shared/web/centre";
import { fmtDay, fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Button, Card, Chip, ChipRow, Heading, List, Place, Section, Skeleton, Stat, Text, useFeedback } from "@/ui";
import BankAccountSheet from "@/features/wallet/BankAccountSheet";
import { useEachRpc } from "./common";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const sum = (a: any[], k: string) => a.reduce((n, x) => n + Number(x?.[k] ?? 0), 0);
const monthLabel = (m: string) => fmtDay(m, { month: "long", year: "numeric" });
const niceDay = (d: string) => fmtDay(d, { day: "numeric", month: "long" });
const poTone = (s: string) => (s === "paid" ? "ok" : s === "failed" ? "bad" : "info") as "ok" | "bad" | "info";

export function DirectorHome() {
  const { p } = useTheme(); const { roles } = useAuth(); const { run, confirm } = useFeedback();
  const ids = useMemo(() => [...new Set(roles.filter((r) => r.role === "centre_director" && r.centre_id).map((r) => r.centre_id as string))].sort(), [roles]);
  const [sel, setSel] = useState("all"); const [monthSel, setMonthSel] = useState("");
  const [bankFor, setBankFor] = useState<{ id: string; label: string } | null>(null);
  const dq = useEachRpc<any>("centre_dashboard", ids, ["income", "payments", "attendance"]);
  const iq = useEachRpc<any>("centre_income_months", ids, ["income", "payments"]);
  const ds = dq.data?.map((r) => r.data).filter(Boolean) as any[] | undefined;
  const inc = iq.data?.map((r) => r.data).filter(Boolean) as any[] | undefined;
  const reload = () => { dq.refetch(); iq.refetch(); };

  // Months a director may see: this month, last month, and older ones only while money is still waiting there.
  const months = useMemo(() => [...new Set((inc ?? []).flatMap((c) => (c.months ?? []).map((m: any) => m.month as string)))].sort().reverse(), [inc]);
  const thisMonth = inc?.[0]?.today ? String(inc[0].today).slice(0, 7) + "-01" : "";
  const month = months.includes(monthSel) ? monthSel : months.includes(thisMonth) ? thisMonth : months[0] ?? "";
  const rows = useMemo(() => (inc ?? []).filter((c) => sel === "all" || c.centre_id === sel)
    .map((c) => ({ c, m: (c.months ?? []).find((x: any) => x.month === month), d: (ds ?? []).find((x) => x.centre?.id === c.centre_id) })).filter((r) => r.m), [inc, ds, sel, month]);
  const netOf = (id?: string) => { const m = (inc ?? []).find((c) => c.centre_id === id)?.months?.find((x: any) => x.month === month); return m ? Number(m.earned) - Number(m.refunds) + Number(m.adjustments) : 0; };

  const withdraw = async (centreId: string, label: string, m: any) => {
    if (!(await confirm({ title: `Withdraw ${naira(m.available)}?`, message: `Your ${monthLabel(m.month)} share${label ? ` from ${label}` : ""} will be sent to your bank account once we approve it. You can cancel until then.`, confirmLabel: "Withdraw" }))) return;
    await run("Requesting…", async () => { await mutate.rpc("request_withdrawal", { p_centre_id: centreId, p_month: m.month }, { invalidates: ["income"] }); reload(); }, { success: "Withdrawal requested" });
  };
  const cancelReq = async (id: string) => {
    if (!(await confirm({ title: "Cancel this withdrawal?", message: "The money stays in your balance. You can withdraw it again later.", confirmLabel: "Cancel request", cancelLabel: "Keep it" }))) return;
    await run("Cancelling…", async () => { await mutate.rpc("cancel_withdrawal", { p_payout_id: id }, { invalidates: ["income"] }); reload(); }, { success: "Request cancelled" });
  };

  const view = useMemo(() => (ds ? (sel === "all" ? ds : ds.filter((d) => d.centre?.id === sel)) : []), [ds, sel]);
  const days = [1, 2, 3, 4, 5, 6, 7].map((n) => sum(view.flatMap((d) => (d.by_weekday ?? []).filter((x: any) => x.day_of_week === n)), "students"));
  const maxDay = Math.max(1, ...days);
  const courses = useMemo(() => { const m = new Map<string, any>(); view.forEach((d) => (d.by_course ?? []).forEach((c: any) => m.set(c.course_id, { ...c, students: (m.get(c.course_id)?.students ?? 0) + c.students }))); return [...m.values()].sort((a, b) => b.students - a.students); }, [view]);
  const earned = rows.reduce((n, r) => n + Number(r.m.earned), 0); const refunds = rows.reduce((n, r) => n + Number(r.m.refunds), 0); const waiting = rows.reduce((n, r) => n + Number(r.m.available), 0);
  const loading = !ds || !inc;
  const ready = !loading && ids.length > 0;
  const refundRows = view.flatMap((d) => d.recent_refunds ?? []).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5);
  const payouts = view.flatMap((d) => (d.recent_payouts ?? []).map((x: any) => ({ ...x, centre: d.centre ? place(d.centre) : "" }))).sort((a: any, b: any) => String(b.paid_at ?? "").localeCompare(String(a.paid_at ?? ""))).slice(0, 8);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ minWidth: 0 }}>
        <Heading size={26} lh={32} numberOfLines={1}>{ids.length > 1 ? "Your branches" : view[0]?.centre ? place(view[0].centre) : "Your centre"}</Heading>
        {ids.length === 1 && view[0]?.centre && place(view[0].centre) !== view[0].centre.name && <Text size={14} tone="muted" numberOfLines={1}>{view[0].centre.name}</Text>}
        <Text size={14} tone="muted">{view.length === 1 ? `Your share here: ${view[0].share_pct}% of student payments` : "Each branch has its own agreed share"}</Text>
      </View>

      {ids.length > 1 && <ChipRow>{[{ id: "all", name: "All branches" }, ...(ds ?? []).map((d) => ({ id: d.centre?.id as string, name: d.centre ? place(d.centre) : "" }))].map((c) => <Chip key={c.id} on={sel === c.id} onPress={() => setSel(c.id)}>{c.name}</Chip>)}</ChipRow>}
      {months.length > 1 && <ChipRow>{months.map((m) => <Chip key={m} on={month === m} onPress={() => setMonthSel(m)}>{m === thisMonth ? "This month" : monthLabel(m)}</Chip>)}</ChipRow>}

      {!ready ? <View style={{ gap: 12 }}><Skeleton height={96} /><Skeleton height={96} /></View> : <>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {[
            { tone: "ok" as const, label: month === thisMonth ? "Earned this month" : `Earned in ${month ? monthLabel(month).split(" ")[0] : ""}`, value: naira(earned) },
            { tone: "bad" as const, label: "Refunds deducted", value: refunds ? "−" + naira(refunds) : naira(0), sub: "Reduce your share" },
            { tone: "info" as const, label: waiting < 0 ? "To be offset" : "Available", value: naira(Math.abs(waiting)), sub: waiting < 0 ? "Refunds exceed income" : "Yours to withdraw" },
            { label: "Active students", value: sum(view, "students_active"), sub: `${sum(view, "students_total")} all time` },
          ].map((s) => <View key={s.label} style={{ width: "48%", flexGrow: 1 }}><Stat compact {...s} /></View>)}
        </View>

        <Section title={month ? monthLabel(month) : "Income"}>
          {rows.map(({ c, m, d }) => {
            const po = m.payout; const label = ids.length > 1 && d?.centre ? place(d.centre) : "";
            return (
              <Card key={c.centre_id} style={{ gap: 10, padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {label ? <Text size={14} weight="semibold" numberOfLines={1}>{label}</Text> : null}
                    <Text size={20} weight="semibold" num>{naira(m.available)}</Text>
                    <Text size={13} tone="muted">{m.withdrawn ? `${naira(m.withdrawn)} already withdrawn` : "Available to withdraw"}</Text>
                  </View>
                  {po && <Badge tone={poTone(po.status)}>{po.status === "draft" ? "Requested" : po.status === "processing" ? "On its way" : po.status === "paid" ? "Paid" : po.status}</Badge>}
                </View>
                {po?.status === "draft"
                  ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text size={13} tone="muted">Waiting for approval.</Text><Pressable accessibilityRole="button" onPress={() => cancelReq(po.id)} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} weight="medium" tone="accent">Cancel</Text></Pressable></View>
                  : po?.status === "processing" ? <Text size={13} tone="muted">{"Approved. It's on its way to your bank."}</Text>
                  : <>
                      <Button style={{ height: 44 }} disabled={!m.can_withdraw} onPress={() => withdraw(c.centre_id, label, m)}>{`Withdraw ${m.available > 0 ? naira(m.available) : ""}`.trim()}</Button>
                      <Text size={13} tone="muted">
                        {m.available <= 0 ? "Nothing to withdraw yet." : !c.account?.ready ? "Add your bank account to withdraw." : !m.can_withdraw ? `Opens ${niceDay(m.opens_on)}, when the month ends.` : "You can also leave it here and withdraw later."}
                      </Text>
                      {!c.account?.ready ? <Button variant="ghost" onPress={() => setBankFor({ id: c.centre_id, label })}>Add bank account</Button> : null}
                    </>}
              </Card>);
          })}
        </Section>

        {sel === "all" && ds!.length > 1 && <Section title="By branch">
          <List>{ds!.map((d) => (
            <Pressable key={d.centre?.id} accessibilityRole="button" onPress={() => setSel(d.centre?.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? p.c.sunken : "transparent" })}>
              <View style={{ flex: 1, minWidth: 0 }}>{d.centre && <Place centre={d.centre} nameOnly numberOfLines={1} />}<Text size={13} tone="muted" numberOfLines={1}>{d.students_active} active · {d.share_pct}% share</Text></View>
              <View style={{ alignItems: "flex-end" }}><Text weight="semibold" num>{naira(netOf(d.centre?.id))}</Text><Text size={11} tone="muted">{month === thisMonth ? "net this month" : "net"}</Text></View>
            </Pressable>))}</List>
        </Section>}

        <Section title="Average attendance by day">
          <Card style={{ height: 112, flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 14 }}>
            {days.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <Text size={11} tone="muted" num>{v || ""}</Text>
                <View style={{ width: "100%", height: (v / maxDay) * 52, minHeight: v ? 6 : 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: p.a("accent", 0.8), opacity: v ? 1 : 0.2 }} />
                <Text size={11} tone="muted">{DAYS[i + 1]}</Text>
              </View>))}
          </Card>
          <Text size={12} tone="muted">Average students present per class, last 8 weeks.{days.every((v) => !v) ? " No classes held yet." : ""}</Text>
        </Section>

        <Section title="Students by course">
          {courses.length === 0 ? <Text size={14} tone="muted">No active students yet.</Text>
            : <List>{courses.map((c) => <View key={c.course_id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}><Text numberOfLines={1} style={{ flex: 1 }}>{c.title}</Text><Text weight="semibold" num>{c.students}</Text></View>)}</List>}
        </Section>

        {refundRows.length > 0 && <Section title="Recent refund deductions">
          <List>{refundRows.map((r: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text size={14} tone="muted" numberOfLines={1} style={{ flex: 1 }}>{fmtWhen(r.created_at, { dateStyle: "short" })} · student refund</Text>
              <Text weight="semibold" tone="bad" num>−{naira(r.share_deducted)}</Text>
            </View>))}</List>
        </Section>}

        <Section title="Payouts">
          {payouts.length === 0 ? <Text size={14} tone="muted">No payouts yet.</Text>
            : <List>{payouts.map((x: any) => (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" num>{naira(x.amount)}</Text><Text size={13} tone="muted" numberOfLines={1}>{ids.length > 1 ? `${x.centre} · ` : ""}{x.paid_at ? fmtWhen(x.paid_at, { dateStyle: "short" }) : "Pending"}</Text></View>
                <Badge tone={x.status === "paid" ? "ok" : x.status === "failed" ? "bad" : "warn"}>{x.status}</Badge>
              </View>))}</List>}
        </Section>
      </>}
      {bankFor ? <BankAccountSheet open onClose={() => setBankFor(null)} target={{ kind: "centre", centreId: bankFor.id, label: bankFor.label }} onSaved={reload} /> : null}
    </View>
  );
}
