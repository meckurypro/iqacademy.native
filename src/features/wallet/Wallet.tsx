// Port of web pages/Wallet.tsx. An instructor's earnings wallet. It works exactly like a centre director's income (see DirectorHome):
// one record per month, a Withdraw button on each month once it ends, older months stay withdrawable.
// Every figure comes from the database (instructor_wallet and friends); this screen only shows it and asks the database to act.
import { useState } from "react";
import { View } from "react-native";
import { friendly, naira, ok, UserMessage } from "@/core/errors";
import { mutate, useQuery, useRpc } from "@/data";
import { fmtDay, fmtWhen } from "@/shared/web/time";
import { Badge, Button, Card, Chip, ChipRow, Empty, Err, PageHeader, Section, Sheet, Skeleton, Stat, Text, useFeedback } from "@/ui";
import BankAccountSheet from "./BankAccountSheet";
import { monthHint, statusInfo } from "./walletUi";

const monthLabel = (m: string) => fmtDay(m, { month: "long", year: "numeric" });
const niceDay = (d: string) => fmtDay(d, { day: "numeric", month: "long" });
const TAGS = ["wallet"];

function Breakdown({ id }: { id: string }) {
  const q = useRpc<any[]>("instructor_earning_breakdown", { p_session_id: id }, { tags: TAGS, ttlMs: 60_000 });
  if (!q.data) return <Skeleton height={80} />;
  if (q.data.length === 0) return <Empty title="No students counted." />;
  return <View style={{ gap: 8 }}>{q.data.map((l, i) => (
    <Card key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{l.name}</Text>
        <Text size={13} tone="muted">{`Class ${l.lesson_no} of ${l.classes} · ${l.rate_bp / 100}% of ${naira(Math.round(l.course_tuition / l.classes))}`}</Text></View>
      <Text weight="semibold" num>{naira(l.amount)}</Text>
    </Card>))}</View>;
}

export default function Wallet() {
  const { run, confirm } = useFeedback();
  const wq = useRpc<any>("instructor_wallet", undefined, { tags: TAGS, ttlMs: 30_000 });
  const eq = useRpc<any[]>("instructor_earnings", { p_limit: 60, p_offset: 0 }, { tags: TAGS, ttlMs: 30_000 });
  const dq = useQuery<any[]>({ key: ["myWithdrawals"], tags: TAGS, ttlMs: 30_000,
    fn: async (sb) => ok(await sb.from("instructor_withdrawals").select("id,amount,status,created_at,paid_at,reject_reason,failure_reason,reference,eligible_through").order("created_at", { ascending: false }).limit(20)) as any[] });
  const [monthSel, setMonthSel] = useState(""); const [bank, setBank] = useState(false); const [cls, setCls] = useState<any>(null);
  const w = wq.data; const reload = () => { wq.refetch(); eq.refetch(); dq.refetch(); };

  const months: string[] = (w?.months ?? []).map((x: any) => x.month);
  const thisMonth = w?.today ? String(w.today).slice(0, 7) + "-01" : "";
  const month = months.includes(monthSel) ? monthSel : months.includes(thisMonth) ? thisMonth : months[0] ?? "";
  const m = (w?.months ?? []).find((x: any) => x.month === month);

  const withdraw = async () => {
    if (!(await confirm({ title: `Withdraw ${naira(m.available)}?`, message: `Your ${monthLabel(m.month)} earnings will be sent to your bank account once we approve it. You can cancel until then.`, confirmLabel: "Withdraw" }))) return;
    await run("Requesting…", async () => {
      try { await mutate.rpc("request_instructor_withdrawal", { p_month: m.month }, { invalidates: TAGS }); }
      catch (e) { throw String((e as Error)?.message).includes("withdrawal_pending") ? new UserMessage("You already have a withdrawal in progress for this month.") : e; }
      reload();
    }, { success: "Withdrawal requested" });
  };
  const cancel = async (id: string) => {
    if (!(await confirm({ title: "Cancel this withdrawal?", message: "The money stays in your balance. You can withdraw it again later.", confirmLabel: "Cancel request", cancelLabel: "Keep it" }))) return;
    await run("Cancelling…", async () => { await mutate.rpc("cancel_instructor_withdrawal", { p_id: id }, { invalidates: TAGS }); reload(); }, { success: "Request cancelled" });
  };

  if (!w) return <View style={{ gap: 16 }}><PageHeader title="Wallet" />{wq.error ? <Err>{String((wq.error as Error).message ?? "").includes("forbidden") ? "The wallet is for instructors." : friendly(wq.error)}</Err> : <><Skeleton height={112} /><Skeleton height={160} /></>}</View>;
  const po = m?.withdrawal; const hint = m ? monthHint(m, w) : "nothing";
  const hintText = hint === "nothing" ? "Nothing to withdraw yet." : hint === "below_min" ? `The smallest withdrawal is ${naira(w.min_payout)}.`
    : hint === "not_open" ? `Opens ${niceDay(m.opens_on)}, when the month ends.` : "You can also leave it here and withdraw later.";

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Wallet" sub="What you earn from the classes you teach" />
      {months.length > 1 ? <ChipRow>{months.map((x) => <Chip key={x} on={month === x} onPress={() => setMonthSel(x)}>{x === thisMonth ? "This month" : monthLabel(x)}</Chip>)}</ChipRow> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ width: "47.5%" }}><Stat compact tone="ok" label={month === thisMonth ? "Earned this month" : `Earned in ${month ? monthLabel(month).split(" ")[0] : ""}`} value={naira(m?.earned ?? 0)} /></View>
        <View style={{ width: "47.5%" }}><Stat compact tone="bad" label="Deducted" value={m?.reversals ? `−${naira(m.reversals)}` : naira(0)} sub="Attendance changes" /></View>
        <View style={{ width: "47.5%" }}><Stat compact tone="info" label={m && m.available < 0 ? "To be offset" : "Available"} value={naira(Math.abs(m?.available ?? 0))} sub={m && m.available < 0 ? "Deductions exceed earnings" : "Yours to withdraw"} /></View>
        <View style={{ width: "47.5%" }}><Stat compact label="All time" value={naira(w.lifetime)} sub={`${naira(w.paid_out)} withdrawn`} /></View>
      </View>
      {w.unfunded > 0 ? <Card><Text size={13} tone="warn">{`${naira(w.unfunded)} is waiting for a student's next instalment. It joins your earnings automatically when they pay.`}</Text></Card> : null}

      {m ? <Section title={monthLabel(m.month)}>
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}><Text size={20} weight="semibold" num>{naira(m.available)}</Text><Text size={13} tone="muted">{m.withdrawn ? `${naira(m.withdrawn)} already withdrawn` : "Available to withdraw"}</Text></View>
            {po ? <Badge tone={statusInfo(po.status).tone}>{statusInfo(po.status).label}</Badge> : null}
          </View>
          {po?.status === "draft" ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text size={13} tone="muted">Waiting for approval.</Text><Button variant="ghost" onPress={() => cancel(po.id)}>Cancel</Button></View>
            : po?.status === "processing" ? <Text size={13} tone="muted">{"Approved. It's on its way to your bank."}</Text>
            : <>
                <Button style={{ height: 40 }} disabled={!m.can_withdraw} onPress={withdraw}>{`Withdraw ${m.available > 0 ? naira(m.available) : ""}`.trim()}</Button>
                {hint === "no_account" ? <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}><Text size={13} tone="muted">Add your bank account to withdraw. </Text><Button variant="ghost" onPress={() => setBank(true)}>Add account</Button></View>
                  : <Text size={13} tone="muted">{hintText}</Text>}
              </>}
          {w.account?.ready && !po?.status?.match(/draft|processing/) ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text size={13} tone="muted" style={{ flex: 1 }} numberOfLines={1}>{`${w.account.bank_name} ••${w.account.account_last4} · ${w.account.account_name}`}</Text>
            <Button variant="ghost" onPress={() => setBank(true)}>Change</Button></View> : null}
        </Card>
      </Section> : null}

      <Section title="Earnings">
        {!eq.data ? <Skeleton height={80} /> : eq.data.length === 0 ? <Empty icon="receipt" title="No earnings yet." hint="Earnings appear here after a class you taught is finished and attendance is final." />
          : <View style={{ gap: 8 }}>{eq.data.map((e) => e.kind === "class" ? (
            <Card key={e.id} onPress={() => setCls(e)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{e.course}</Text>
                <Text size={14} tone="muted" numberOfLines={1}>{`${e.centre}${e.city ? ` · ${e.city}` : ""} · ${fmtDay(e.day, { day: "numeric", month: "short" })} · ${e.students} student${e.students === 1 ? "" : "s"}`}</Text></View>
              <Text weight="semibold" num>{naira(e.amount)}</Text>
            </Card>) : (
            <Card key={e.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}><Text weight="medium">Adjustment</Text><Text size={14} tone="muted">{`${e.note} · ${fmtDay(e.day, { day: "numeric", month: "short" })}`}</Text></View>
              <Text weight="semibold" num>{`${e.amount < 0 ? "−" : ""}${naira(Math.abs(e.amount))}`}</Text>
            </Card>))}</View>}
      </Section>

      <Section title="Withdrawals">
        {!dq.data ? <Skeleton height={64} /> : dq.data.length === 0 ? <Empty icon="receipt" title="No withdrawals yet." />
          : <View style={{ gap: 8 }}>{dq.data.map((x) => (
            <Card key={x.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <View><Text weight="semibold" num>{naira(x.amount)}</Text><Text size={14} tone="muted">{`${monthLabel(x.eligible_through)} · asked ${fmtWhen(x.created_at, { dateStyle: "medium" })}`}</Text></View>
                <Badge tone={statusInfo(x.status).tone}>{statusInfo(x.status).label}</Badge></View>
              {x.reject_reason ? <Text size={14} tone="bad">{x.reject_reason}</Text> : null}
              {x.failure_reason ? <Text size={14} tone="bad">{`${x.failure_reason}. The money is back in your balance.`}</Text> : null}
              {x.status === "paid" ? <Text size={12} tone="muted">{`Sent ${x.paid_at ? fmtWhen(x.paid_at, { dateStyle: "medium" }) : ""} · reference ${x.reference}`}</Text> : null}
            </Card>))}</View>}
      </Section>

      <Sheet open={!!cls} onClose={() => setCls(null)} title={cls?.course ?? "Class earnings"}>
        {cls ? <View style={{ gap: 12 }}>
          <Text size={14} tone="muted">{`${cls.centre} · ${fmtDay(cls.day, { day: "numeric", month: "long" })}`}</Text>
          <Breakdown id={cls.id} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text weight="medium">Total</Text><Text size={18} weight="semibold" num>{naira(cls.amount)}</Text></View>
        </View> : null}
      </Sheet>
      <BankAccountSheet open={bank} onClose={() => setBank(false)} target={{ kind: "instructor" }} onSaved={reload} />
    </View>
  );
}
