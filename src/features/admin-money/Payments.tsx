// Port of web pages/Payments.tsx. Admin: student payments and refunds. A refund either goes out through Paystack (the account name is verified first) or is recorded
// when it was paid by hand. The centre's share is deducted from its next payout. Money: online-only, confirmed, and behind the step-up check (M12).
import { useState } from "react";
import { View } from "react-native";
import { friendly, naira, ok, rawMessage, UserMessage } from "@/core/errors";
import { online, useQuery } from "@/data";
import { requireStepUp } from "@/features/security/stepUp";
import { useBanks } from "@/features/admin-people/useBanks";
import { placeLabel } from "@/shared/web/centre";
import { fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Badge, Button, Card, Empty, Err, Field, Icon, PageHeader, Place, SearchField, Segmented, SelectSheet, Sheet, Skeleton, SwitchRow, Text, useFeedback } from "@/ui";
import { callAdminFunction } from "./adminFn";

 
const tone = (s: string) => (s === "succeeded" || s === "paid" ? "ok" : s === "failed" ? "bad" : s.includes("refund") || s === "processing" ? "warn" : "muted") as "ok" | "bad" | "warn" | "muted";
type F = { amt: string; why: string; cancel: boolean; method: "paystack" | "manual"; bank: string; acct: string; note: string; accName: string };
const blank = (x: any): F => ({ amt: "", why: "", cancel: x.refunded_amount === 0, method: "paystack", bank: "", acct: "", note: "", accName: "" });

export default function Payments() {
  const { p: th } = useTheme(); const { run, confirm } = useFeedback();
  const [tab, setTab] = useState<"payments" | "refunds">("payments"); const [q, setQ] = useState("");
  const [p, setP] = useState<any>(null); const [f, setF] = useState<F>(blank({ amount: 0, refunded_amount: 0 })); const [err, setErr] = useState(""); const [done, setDone] = useState("");
  const dq = useQuery<{ pay: any[]; refs: any[] }>({
    key: ["adminPayments"], tags: ["payments"], ttlMs: 30_000,
    fn: async (sb) => {
      const [a, b] = await Promise.all([
        sb.from("payments").select("id,reference,amount,refunded_amount,status,paid_at,provider,channel,centres(name,city,address),students(profiles(full_name))").in("status", ["succeeded", "partially_refunded", "refunded"]).order("paid_at", { ascending: false }).limit(100),
        sb.from("refunds").select("id,amount,status,method,reason,failure_reason,created_at,account_name,account_last4,bank_name,centres(name,city,address),students(profiles(full_name))").order("created_at", { ascending: false }).limit(50),
      ]);
      return { pay: (ok(a) as any[]) ?? [], refs: (ok(b) as any[]) ?? [] };
    },
  });
  const rows = dq.data?.pay; const refs = dq.data?.refs; const loadErr = dq.error && !dq.data ? friendly(dq.error) : "";
  const banks = useBanks(!!p).data ?? [];
  const name = (x: any) => x.students?.profiles?.full_name ?? "Unknown";
  const shown = (rows ?? []).filter((x) => !q.trim() || (name(x) + x.reference + (x.centres ? placeLabel(x.centres) : "")).toLowerCase().includes(q.trim().toLowerCase()));
  const infoQ = useQuery<any>({ key: ["refundInfo", p?.id ?? ""], tags: ["payments"], ttlMs: 0, enabled: !!p, fn: async (sb) => ok(await sb.rpc("payment_refund_info", { p_payment_id: p.id })) });
  const info = infoQ.data;
  const left = p ? (info ? Number(info.max_refund) : p.amount - p.refunded_amount) : 0; // never more than the unused classes are worth
  const kobo = f.amt === "" ? left : Math.round(Number(f.amt) * 100);

  const open = (x: any) => { setP(x); setErr(""); setDone(""); setF(blank(x)); };
  const verify = async () => {
    setErr("");
    const r = await run("Verifying account…", () => callAdminFunction<{ account_name?: string }>("paystack-create-recipient", { action: "resolve", bank_code: f.bank, account_number: f.acct }), { quiet: true });
    if (!r.ok) return setErr(r.message);
    if (r.data.account_name) setF({ ...f, accName: r.data.account_name }); else setErr("Couldn't find that account. Check the bank and number.");
  };
  const send = async () => {
    setErr("");
    const paystack = f.method === "paystack";
    const yes = await confirm({
      title: paystack ? `Send ${naira(kobo)} to ${f.accName}?` : `Record a manual refund of ${naira(kobo)}?`,
      message: `${paystack ? "The money leaves your Paystack balance straight away. " : ""}${f.cancel ? "Their enrolment will also be cancelled." : "Their enrolment stays active."} This can't be undone.`,
      confirmLabel: paystack ? "Send refund" : "Record refund", danger: true,
    });
    if (!yes) return;
    if (!(await requireStepUp(paystack ? "Confirm sending this refund" : "Confirm recording this refund"))) return setErr("Not confirmed. Nothing was sent.");
    const r = await run(paystack ? "Sending refund…" : "Recording refund…", async () => {
      let message: string;
      if (paystack) {
        const out = await callAdminFunction<{ message?: string }>("process-refund", { payment_id: p.id, amount: kobo, reason: f.why || null, cancel_enrolment: f.cancel, bank_code: f.bank, account_number: f.acct }, ["payments", "refunds"]);
        message = out.message ?? "Refund sent.";
      } else {
        const bankName = banks.find((b) => b.code === f.bank)?.name ?? null;
        await online(async (sb) => {
          const { error } = await sb.rpc("record_manual_refund", { p_payment_id: p.id, p_amount: kobo, p_reason: f.why || null, p_cancel_enrolment: f.cancel, p_note: f.note || null, p_bank_name: bankName, p_account_name: f.accName || null, p_account_last4: f.acct ? f.acct.slice(-4) : null });
          if (error) throw error.message.includes("invalid_refund_amount") ? new UserMessage("That's more than can still be refunded.") : error.message.includes("refund_exceeds_unused_classes") ? new UserMessage("Classes the student already attended can't be refunded.") : error;
        }, { invalidates: ["payments", "refunds"] });
        message = "Refund recorded. The student and the centre have been updated.";
      }
      await dq.refetch();
      return message;
    }, { quiet: true });
    if (!r.ok) return setErr(r.message || rawMessage(r.error));
    setDone(r.data);
  };
  const ready = kobo > 0 && kobo <= left && (f.method === "manual" ? f.note.trim().length > 2 : !!f.accName);

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Payments & refunds" />
      <Segmented value={tab} onChange={setTab} options={[{ value: "payments", label: "Payments" }, { value: "refunds", label: "Refunds" }]} />
      {loadErr ? <View style={{ gap: 8 }}><Err>{loadErr}</Err><Button variant="secondary" onPress={() => dq.refetch()}>Try again</Button></View> : null}

      {tab === "payments" && <>
        <SearchField label="Search payments" value={q} onChangeText={setQ} placeholder="Search by student, centre or reference" autoCapitalize="none" />
        {!rows ? <Skeleton height={80} /> : shown.length === 0 ? <Empty title="No payments found." /> : shown.map((x) => (
          <Card key={x.id} onPress={() => open(x)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="medium" numberOfLines={1}>{name(x)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>{x.centres ? <Place centre={x.centres} nameOnly size={14} tone="muted" /> : null}<Text size={14} tone="muted">{` · ${x.paid_at ? fmtWhen(x.paid_at, { dateStyle: "short" }) : ""} · ${x.channel === "cash" ? "cash" : x.provider}`}</Text></View>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}><Text weight="semibold" num>{naira(x.amount)}</Text>{x.refunded_amount > 0 ? <Badge tone="info">−{naira(x.refunded_amount)} refunded</Badge> : <Badge tone={tone(x.status)}>{x.status}</Badge>}</View>
          </Card>))}
      </>}

      {tab === "refunds" && (!refs ? <Skeleton height={80} /> : refs.length === 0 ? <Empty title="No refunds yet." /> : refs.map((r) => (
        <Card key={r.id} style={{ gap: 4, paddingVertical: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{name(r)}</Text><View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>{r.centres ? <Place centre={r.centres} nameOnly size={14} tone="muted" /> : null}<Text size={14} tone="muted">{` · ${fmtWhen(r.created_at, { dateStyle: "short" })} · ${r.method === "paystack" ? "Paystack" : "Manual"}`}</Text></View></View>
            <View style={{ alignItems: "flex-end", gap: 4 }}><Text weight="semibold" num>{naira(r.amount)}</Text><Badge tone={tone(r.status)}>{r.status}</Badge></View>
          </View>
          {r.account_name ? <Text size={12} tone="muted">{r.bank_name} ••{r.account_last4} · {r.account_name}</Text> : null}
          {r.failure_reason ? <Text size={14} tone="bad">{r.failure_reason}</Text> : null}
        </Card>)))}

      <Sheet open={!!p} onClose={() => setP(null)} title="Refund a student">
        {p && (done ? (
          <View style={{ alignItems: "center", gap: 16, paddingVertical: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: th.a("ok", 0.15) }}><Icon name="check" size={32} color={th.c.ok} /></View>
            <Text align="center">{done}</Text><Button style={{ alignSelf: "stretch" }} onPress={() => setP(null)}>Done</Button>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View><Text weight="medium">{name(p)}</Text><View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}><Text size={14} tone="muted">{`Paid ${naira(p.amount)} · `}</Text>{p.centres ? <Place centre={p.centres} nameOnly size={14} tone="muted" /> : null}</View></View>
            {info && info.attended > 0 ? <Text size={14} tone="muted">{`This student attended ${info.attended} of ${info.total_classes} classes. Attended classes can't be refunded, so you can refund up to ${naira(Math.max(0, left))}.`}</Text> : null}
            {left <= 0 ? <Text tone="muted">{p.amount - p.refunded_amount > 0 ? "Nothing can be refunded: the classes attended are worth what was paid." : "This payment has already been fully refunded."}</Text> : <>
              <Field label={`Amount to refund (₦, up to ${left / 100})`} keyboardType="decimal-pad" value={f.amt === "" ? String(left / 100) : f.amt} onChangeText={(v) => setF({ ...f, amt: v.replace(/[^\d.]/g, "") })} />
              <Field label="Reason" value={f.why} onChangeText={(v) => setF({ ...f, why: v })} placeholder="Optional" />
              <SwitchRow title="Also cancel their enrolment" hint="Removes access to classes." value={f.cancel} onChange={(v) => setF({ ...f, cancel: v })} />
              <Segmented value={f.method} onChange={(m) => setF({ ...f, method: m })} options={[{ value: "paystack", label: "Pay with Paystack" }, { value: "manual", label: "I paid manually" }]} />
              <Text size={14} tone="muted">{"Collect the student's bank details. "}{f.method === "manual" ? "Optional for manual refunds, but keep a note of how you paid." : "We verify the account name before any money moves."}</Text>
              <SelectSheet label="Bank" value={f.bank} placeholder={banks.length ? "Bank…" : "Loading banks…"} options={banks.map((b) => ({ value: b.code, label: b.name }))} onChange={(v) => setF({ ...f, bank: v, accName: "" })} />
              <Field label="Account number" keyboardType="number-pad" maxLength={10} value={f.acct} onChangeText={(v) => setF({ ...f, acct: v.replace(/\D/g, ""), accName: "" })} />
              {f.accName ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.xl, backgroundColor: th.a("ok", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Icon name="check" size={16} color={th.c.ok} /><Text size={14} tone="ok" style={{ flex: 1 }}>{f.accName}</Text></View> : null}
              {f.method === "manual" && <Field label="How you paid" value={f.note} onChangeText={(v) => setF({ ...f, note: v })} placeholder="e.g. GTB transfer, ref 123456" />}
              <View style={{ borderRadius: radius.xl, backgroundColor: th.a("warn", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="warn">{"The centre's share of this refund is deducted from their next payout, and the student and centre are notified."}</Text></View>
              <Err>{err}</Err>
              {f.method === "paystack" && !f.accName ? <Button disabled={!f.bank || f.acct.length !== 10 || !(kobo > 0 && kobo <= left)} onPress={verify}>Verify account</Button>
                : <Button disabled={!ready} onPress={send}>{f.method === "paystack" ? `Send ${naira(kobo)} to ${f.accName.split(" ")[0]}` : `Record manual refund of ${naira(kobo)}`}</Button>}
            </>}
          </View>))}
      </Sheet>
    </View>
  );
}
