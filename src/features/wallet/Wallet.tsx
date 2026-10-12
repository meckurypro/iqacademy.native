// Port of web pages/Wallet.tsx. An instructor's earnings wallet. Every figure comes from the database (instructor_wallet and friends);
// this screen only shows it and asks the database to act. Withdrawals are money, so they are online-only and confirmed first.
import { useState } from "react";
import { View } from "react-native";
import { friendly, naira, ok, UserMessage } from "@/core/errors";
import { mutate, useQuery, useRpc } from "@/data";
import { fmtDay, fmtWhen } from "@/shared/web/time";
import { Badge, Button, Card, Empty, Err, PageHeader, Section, Sheet, Skeleton, Stat, Text, useFeedback } from "@/ui";
import BankAccountSheet from "./BankAccountSheet";
import { statusInfo, withdrawState } from "./walletUi";

const monthLabel = (m: string) => fmtDay(m, { month: "long", year: "numeric" });
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
  const [bank, setBank] = useState(false); const [cls, setCls] = useState<any>(null);
  const w = wq.data; const reload = () => { wq.refetch(); eq.refetch(); dq.refetch(); };

  const withdraw = async () => {
    if (!(await confirm({ title: `Withdraw ${naira(w.available)}?`,
      message: `Your earnings through ${monthLabel(w.eligible_through)} go to ${w.account?.bank_name ?? "your bank"} ••${w.account?.account_last4}. The amount is set aside now and an admin reviews it before it is sent. You can cancel until then.`, confirmLabel: "Withdraw" }))) return;
    await run("Requesting…", async () => {
      try { await mutate.rpc("request_instructor_withdrawal", {}, { invalidates: TAGS }); }
      catch (e) { throw String((e as Error)?.message).includes("withdrawal_pending") ? new UserMessage("You already have a withdrawal in progress.") : e; }
      reload();
    }, { success: "Withdrawal requested" });
  };
  const cancel = async (id: string) => {
    if (!(await confirm({ title: "Cancel this withdrawal?", message: "The money goes back to your balance. You can withdraw it again later.", confirmLabel: "Cancel request", cancelLabel: "Keep it" }))) return;
    await run("Cancelling…", async () => { await mutate.rpc("cancel_instructor_withdrawal", { p_id: id }, { invalidates: TAGS }); reload(); }, { success: "Request cancelled" });
  };

  if (!w) return <View style={{ gap: 16 }}><PageHeader title="Wallet" />{wq.error ? <Err>{String((wq.error as Error).message ?? "").includes("forbidden") ? "The wallet is for instructors." : friendly(wq.error)}</Err> : <><Skeleton height={112} /><Skeleton height={160} /></>}</View>;
  const open = w.open_withdrawal; const state = withdrawState(w);
  const hint = state === "no_account" ? "Add your bank account to withdraw."
    : state === "nothing" ? `Nothing to withdraw yet. A month's earnings open on its last day (${fmtDay(w.opens_on, { day: "numeric", month: "long" })} for this month).`
    : state === "below_min" ? `The smallest withdrawal is ${naira(w.min_payout)}.` : `Earnings through ${monthLabel(w.eligible_through)}. Older months stay here until you withdraw them.`;

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Wallet" sub="What you earn from the classes you teach" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[["Available", w.available, "ok"], ["This month", w.this_month, undefined], ["All time", w.lifetime, undefined], ["Withdrawn", w.paid_out, "info"]].map(([l, v, t]) => (
          <View key={String(l)} style={{ width: "47.5%" }}><Stat compact label={String(l)} value={naira(Number(v))} tone={t as any} /></View>))}
      </View>
      {w.unfunded > 0 ? <Card><Text size={13} tone="warn">{`${naira(w.unfunded)} from recent classes is waiting for a student's next payment. It joins your balance automatically.`}</Text></Card> : null}

      <Card style={{ gap: 12 }}>
        {open ? <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text size={20} weight="semibold" num>{naira(open.amount)}</Text><Badge tone={statusInfo(open.status).tone}>{statusInfo(open.status).label}</Badge></View>
          {open.status === "draft"
            ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text size={13} tone="muted">Set aside. An admin will review it.</Text><Button variant="ghost" onPress={() => cancel(open.id)}>Cancel</Button></View>
            : <Text size={13} tone="muted">{"Approved. It's on its way to your bank."}</Text>}
        </> : <>
          <Button style={{ height: 44 }} disabled={!w.can_withdraw} onPress={withdraw}>{`Withdraw ${w.available > 0 ? naira(w.available) : ""}`.trim()}</Button>
          <Text size={13} tone="muted">{hint}</Text>
        </>}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text size={14} tone="muted" style={{ flex: 1 }} numberOfLines={1}>{w.account ? `${w.account.bank_name} ••${w.account.account_last4} · ${w.account.account_name}` : "No bank account yet"}</Text>
          <Button variant="ghost" onPress={() => setBank(true)}>{w.account ? "Change" : "Add account"}</Button>
        </View>
      </Card>

      <Section title="By month">
        {(w.months ?? []).length === 0 ? <Empty icon="receipt" title="No earnings yet." hint="Earnings appear here after a class you taught is finished and attendance is final." />
          : <View style={{ gap: 8 }}>{(w.months as any[]).map((m) => (
            <Card key={m.month} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View><Text weight="medium">{monthLabel(m.month)}</Text><Text size={14} tone="muted">{m.withdrawn > 0 ? `${naira(m.withdrawn)} withdrawn` : "Nothing withdrawn"}</Text></View>
              <View style={{ alignItems: "flex-end", gap: 4 }}><Text weight="semibold" num>{naira(m.earned)}</Text><Badge tone={m.open ? "ok" : "muted"}>{m.open ? "Open to withdraw" : "Month in progress"}</Badge></View>
            </Card>))}</View>}
      </Section>

      <Section title="Earnings">
        {!eq.data ? <Skeleton height={80} /> : eq.data.length === 0 ? <Empty icon="receipt" title="No earnings yet." />
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
                <View><Text weight="semibold" num>{naira(x.amount)}</Text><Text size={14} tone="muted">{`Asked ${fmtWhen(x.created_at, { dateStyle: "medium" })} · through ${monthLabel(x.eligible_through)}`}</Text></View>
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
