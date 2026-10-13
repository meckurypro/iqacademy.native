// Port of web pages/InstructorPayouts.tsx (admin). Review instructor withdrawals, look at wallets, fix exceptions.
// Nobody edits a balance: the only change is a signed, reasoned adjustment (admin_adjust_instructor). Sending money needs the step-up check.
// Native keeps the earnings view per instructor (tap a wallet); the web date-range explorer is not ported (see PARITY).
import { useState } from "react";
import { View } from "react-native";
import { friendly, naira, ok } from "@/core/errors";
import { mutate, useQuery, useRpc } from "@/data";
import { requireStepUp } from "@/features/security/stepUp";
import { statusInfo } from "@/features/wallet/walletUi";
import { fmtDay, fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Badge, Button, Card, Empty, Err, Field, SearchField, Section, Segmented, Sheet, Skeleton, Text, useFeedback } from "@/ui";
import { callAdminFunction } from "./adminFn";

const TAGS = ["wallet", "payments"];
const FN = "process-payouts";

export default function InstructorPayouts() {
  const { p: th } = useTheme(); const { run, confirm } = useFeedback();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [q, setQ] = useState("");
  const [rej, setRej] = useState<any>(null); const [why, setWhy] = useState("");
  const [sheet, setSheet] = useState<any>(null); const [adj, setAdj] = useState({ amt: "", why: "", sign: "add" as "add" | "deduct" });
  const [notFound, setNotFound] = useState<Record<string, boolean>>({});

  const st = useQuery<{ configured: boolean }>({ key: ["payoutsConfigured"], tags: TAGS, ttlMs: 60_000, fn: async () => callAdminFunction<{ configured: boolean }>(FN, { action: "status" }) });
  const wd = useRpc<any[]>("admin_instructor_withdrawals", undefined, { tags: TAGS, ttlMs: 20_000 });
  const wl = useRpc<any[]>("admin_instructor_wallets", { p_search: q.trim() || null }, { tags: TAGS, ttlMs: 20_000 });
  const ex = useRpc<any>("admin_instructor_exceptions", undefined, { tags: TAGS, ttlMs: 20_000 });
  const hist = useQuery<any[]>({ key: ["instrEarnings", sheet?.id ?? ""], tags: TAGS, ttlMs: 20_000, enabled: !!sheet,
    fn: async (sb) => ok(await sb.rpc("admin_instructor_earnings", { p_instructor: sheet.id, p_limit: 30, p_offset: 0 })) as any[] });
  const configured = st.data?.configured; const reloadAll = () => { wd.refetch(); wl.refetch(); ex.refetch(); };

  const act = async (label: string, body: object, id?: string) => {
    setErr(""); setMsg("");
    const r = await run(label, async () => { try { return await callAdminFunction<{ message?: string; status?: string }>(FN, body, TAGS); } finally { reloadAll(); } }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    if (r.data.status === "not_found" && id) setNotFound((n) => ({ ...n, [id]: true }));
    setMsg(r.data.message ?? "Done.");
  };
  const send = async (x: any) => {
    if (x.name_match === false && !(await confirm({ title: "The account name doesn't match", message: `The bank account is in the name "${x.account_name}", which doesn't match the instructor's profile. Send anyway?`, confirmLabel: "Send anyway", danger: true }))) return;
    if (!(await confirm({ title: `Send ${naira(x.amount)} to ${x.instructor}?`, message: `It goes to ${x.bank_name} ••${x.account_last4} (${x.account_name}). This can't be undone.`, confirmLabel: "Send payout", danger: true }))) return;
    if (!(await requireStepUp("Confirm sending this payout"))) { setMsg(""); return setErr("Not confirmed. Nothing was sent."); }
    await act("Sending payout…", { action: "send_instructor", withdrawal_id: x.id });
  };
  const reject = async () => { const id = rej.id; setRej(null); await act("Rejecting…", { action: "reject_instructor", withdrawal_id: id, reason: why }); setWhy(""); };
  const adjust = async () => {
    const kobo = Math.round(Number(adj.amt || 0) * 100) * (adj.sign === "add" ? 1 : -1);
    if (!(await confirm({ title: `${kobo > 0 ? "Add" : "Deduct"} ${naira(Math.abs(kobo))}?`, message: `${sheet.name} is told about it. The reason is saved with your name.`, confirmLabel: "Record adjustment", danger: kobo < 0 }))) return;
    const r = await run("Recording…", async () => { await mutate.rpc("admin_adjust_instructor", { p_instructor: sheet.id, p_amount: kobo, p_reason: adj.why }, { invalidates: TAGS }); reloadAll(); }, { success: "Adjustment recorded", quiet: true });
    if (!r.ok) return setErr(r.message); setSheet(null); setAdj({ amt: "", why: "", sign: "add" });
  };
  const postNow = (id: string) => run("Posting…", async () => { await mutate.rpc("admin_post_session_earnings", { p_session_id: id }, { invalidates: TAGS }); reloadAll(); }, { success: "Posted" });

  const e = ex.data; const attention = e ? ["missing_posts", "no_instructor", "unfunded", "errors", "stuck_withdrawals", "negative_balances", "name_mismatch"].reduce((n, k) => n + (e[k]?.length ?? 0), 0) : 0;
  const note = (txt: string, tone: "ok" | "warn") => <View style={{ borderRadius: radius.xl, backgroundColor: th.a(tone, 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={13} tone={tone}>{txt}</Text></View>;

  return (
    <View style={{ gap: 16 }}>
      {configured === false ? <Card style={{ gap: 4 }}><Text weight="medium" tone="warn">Payouts are waiting for secure setup</Text>
        <Text size={13} tone="warn">You can review and reject requests. Sending is switched off until the Paystack secret key is stored as a Supabase secret (name: PAYSTACK_SECRET_KEY). Nothing is marked as sent until Paystack confirms it.</Text></Card> : null}
      {msg ? note(msg, "ok") : null}<Err>{err || (wd.error && !wd.data ? friendly(wd.error) : "")}</Err>

      <Section title="Withdrawal requests">
        {!wd.data ? <Skeleton height={96} /> : wd.data.length === 0 ? <Empty title="No instructor withdrawals yet." /> : wd.data.map((x) => (
          <Card key={x.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}><Text size={20} weight="semibold" num>{naira(x.amount)}</Text>
                <Text size={14} tone="muted">{`${x.instructor} · ${fmtWhen(x.created_at, { dateStyle: "medium" })} · for ${fmtDay(x.eligible_through, { month: "long", year: "numeric" })}`}</Text></View>
              <Badge tone={statusInfo(x.status).tone}>{x.status === "draft" ? "Needs review" : statusInfo(x.status).label}</Badge>
            </View>
            <Text size={14} tone="muted">{`${x.bank_name} ••${x.account_last4} · ${x.account_name}`}</Text>
            {x.name_match === false ? <Badge tone="bad">Name differs from profile</Badge> : null}
            {x.reference ? <Text size={12} tone="muted">{`Reference ${x.reference}${x.paid_at ? ` · paid ${fmtWhen(x.paid_at, { dateStyle: "medium" })}` : ""}`}</Text> : null}
            {x.reject_reason ? <Text size={14} tone="bad">{x.reject_reason}</Text> : null}{x.failure_reason ? <Text size={14} tone="bad">{x.failure_reason}</Text> : null}
            {x.status === "draft" ? <View style={{ flexDirection: "row", gap: 8 }}><Button style={{ height: 40, flex: 1 }} disabled={configured !== true} onPress={() => send(x)}>{`Send ${naira(x.amount)}`}</Button><Button variant="secondary" style={{ height: 40 }} onPress={() => setRej(x)}>Reject</Button></View> : null}
            {x.status === "processing" ? <View style={{ flexDirection: "row", gap: 8 }}>
              <Button variant="secondary" style={{ height: 40, flex: 1 }} disabled={configured !== true} onPress={() => act("Checking with Paystack…", { action: "reconcile", reference: x.reference }, x.id)}>Check with Paystack</Button>
              {notFound[x.id] ? <Button style={{ height: 40 }} onPress={() => act("Re-sending…", { action: "retry_instructor", withdrawal_id: x.id })}>Retry send</Button> : null}</View> : null}
          </Card>))}
      </Section>

      <Section title="Needs attention" aside={<Badge tone={attention ? "warn" : "ok"}>{attention ? String(attention) : "All clear"}</Badge>}>
        {e && attention > 0 ? <View style={{ gap: 8 }}>
          {(e.missing_posts ?? []).map((m: any) => <Card key={m.session_id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><View style={{ flex: 1 }}><Text weight="medium">Finished class not paid out</Text><Text size={14} tone="muted">{`${m.course} · ${fmtDay(m.day, { day: "numeric", month: "short" })}`}</Text></View><Button style={{ height: 36 }} onPress={() => postNow(m.session_id)}>Post now</Button></Card>)}
          {(e.no_instructor ?? []).map((m: any) => <Card key={m.session_id}><Text weight="medium">Finished class with no instructor</Text><Text size={14} tone="muted">{`${m.course} · ${fmtDay(m.day, { day: "numeric", month: "short" })}. Nobody earns until an instructor is set.`}</Text></Card>)}
          {(e.unfunded ?? []).length > 0 ? <Card><Text weight="medium">{`${e.unfunded.length} earning(s) waiting for student payment`}</Text><Text size={14} tone="muted">{`${naira(e.unfunded.reduce((n: number, u: any) => n + Number(u.amount), 0))} total. They join the balance when the student pays.`}</Text></Card> : null}
          {(e.errors ?? []).map((m: any, i: number) => <Card key={i}><Text weight="medium" tone="bad">Posting error</Text><Text size={14} tone="muted">{m.error}</Text></Card>)}
          {(e.stuck_withdrawals ?? []).map((m: any) => <Card key={m.id}><Text weight="medium">Withdrawal processing for over 2 hours</Text><Text size={14} tone="muted">{`${naira(m.amount)} · ${m.reference}. Use "Check with Paystack" above.`}</Text></Card>)}
          {(e.negative_balances ?? []).map((m: any) => <Card key={m.instructor_id}><Text weight="medium" tone="bad">Negative balance</Text><Text size={14} tone="muted">{`${naira(m.balance)}. It is offset by their next earnings.`}</Text></Card>)}
          {(e.name_mismatch ?? []).map((m: any) => <Card key={m.id}><Text weight="medium">Account name differs from profile</Text><Text size={14} tone="muted">{`${naira(m.amount)} request to "${m.account_name}". Check before sending.`}</Text></Card>)}
        </View> : null}
      </Section>

      <Section title="Instructor wallets">
        <SearchField label="Search by name or email" value={q} onChangeText={setQ} />
        {!wl.data ? <Skeleton height={80} /> : wl.data.length === 0 ? <Empty title="No instructors found." /> : wl.data.map((x) => (
          <Card key={x.id} onPress={() => { setSheet(x); setAdj({ amt: "", why: "", sign: "add" }); }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{x.name}</Text>
              <Text size={14} tone="muted" numberOfLines={2}>{`All time ${naira(x.lifetime)} · paid out ${naira(x.paid_out)}${x.reserved > 0 ? ` · ${naira(x.reserved)} requested` : ""}${!x.has_account ? " · no bank account" : ""}`}</Text></View>
            <View style={{ alignItems: "flex-end", gap: 4 }}><Text weight="semibold" num>{naira(x.balance)}</Text>{x.unfunded > 0 ? <Badge tone="warn">{`${naira(x.unfunded)} unfunded`}</Badge> : null}</View>
          </Card>))}
      </Section>

      <Sheet open={!!rej} onClose={() => setRej(null)} title="Reject this withdrawal">
        <View style={{ gap: 12 }}><Text size={14} tone="muted">{rej ? `${naira(rej.amount)} goes back to ${rej.instructor}'s balance and they see your reason.` : ""}</Text>
          <Field label="Reason" value={why} onChangeText={setWhy} /><Button disabled={why.trim().length < 3} onPress={reject}>Reject</Button></View>
      </Sheet>
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet?.name ?? ""}>
        {sheet ? <View style={{ gap: 12 }}>
          <Text size={14} tone="muted">{`Balance ${naira(sheet.balance)}. Adjustments are the only way to change it and each one is recorded with your name and reason.`}</Text>
          <Segmented value={adj.sign} onChange={(v) => setAdj({ ...adj, sign: v })} options={[{ value: "add", label: "Add" }, { value: "deduct", label: "Deduct" }]} />
          <Field label="Amount (₦)" keyboardType="decimal-pad" value={adj.amt} onChangeText={(t) => setAdj({ ...adj, amt: t })} />
          <Field label="Reason" value={adj.why} onChangeText={(t) => setAdj({ ...adj, why: t })} />
          <Button disabled={!(Number(adj.amt) > 0) || adj.why.trim().length < 5} onPress={adjust}>Record adjustment</Button>
          <Text weight="medium">Recent earnings</Text>
          {!hist.data ? <Skeleton height={60} /> : hist.data.length === 0 ? <Text size={14} tone="muted">No earnings yet.</Text> : hist.data.map((r) => (
            <View key={r.session_id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text size={14} tone="muted" style={{ flex: 1 }} numberOfLines={1}>{`${r.course} · ${fmtDay(r.day, { day: "numeric", month: "short" })} · ${r.students} student${r.students === 1 ? "" : "s"}`}</Text>
              <Text size={14} weight="semibold" num>{naira(r.amount)}</Text></View>))}
        </View> : null}
      </Sheet>
    </View>
  );
}
