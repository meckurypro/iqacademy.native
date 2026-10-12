// Port of web pages/Payouts.tsx. Directors ask to withdraw a month at a time; an admin reviews each request and sends it to the centre's bank account.
// Money: online-only, confirmed, and "send" is behind the step-up check (M12). Cancelling a draft moves no money, so it only asks to confirm.
import { useState } from "react";
import { View } from "react-native";
import { friendly, naira, ok } from "@/core/errors";
import { useQuery } from "@/data";
import { requireStepUp } from "@/features/security/stepUp";
import { placeLabel } from "@/shared/web/centre";
import { fmtDay } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Badge, Button, Card, Empty, Err, Heading, Place, Segmented, Skeleton, Text, useFeedback } from "@/ui";
import { callAdminFunction } from "./adminFn";
import InstructorPayouts from "./InstructorPayouts";

 
const tone = (s: string) => (s === "paid" ? "ok" : s === "failed" ? "bad" : s === "processing" ? "warn" : "muted") as "ok" | "bad" | "warn" | "muted";

export default function Payouts() {
  const { p: th } = useTheme(); const { run, confirm } = useFeedback();
  const [tab, setTab] = useState<"centres" | "instructors">("centres");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const q = useQuery<any[]>({ key: ["adminPayouts"], tags: ["payments", "income"], ttlMs: 30_000, fn: async (sb) => (ok(await sb.from("payouts").select("id,amount,status,reference,period_start,period_end,period_month,paid_at,failure_reason,centres(name,city,address)").order("created_at", { ascending: false }).limit(50)) as any[]) ?? [] });
  const rows = q.data; const loadErr = q.error && !rows ? friendly(q.error) : "";

  const act = async (label: string, body: object) => {
    setErr(""); setMsg("");
    const r = await run(label, async () => {
      try { return await callAdminFunction<{ message?: string; drafts_created?: number }>("process-payouts", body, ["payments", "income"]); }
      finally { await q.refetch(); } // the list can change even when the call fails (a transfer that was started)
    }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    setMsg(r.data.message ?? (r.data.drafts_created !== undefined ? `${r.data.drafts_created} draft payout(s) prepared.` : "Done."));
  };
  const send = async (p: any) => {
    if (!(await confirm({ title: `Send ${naira(p.amount)} to ${p.centres ? placeLabel(p.centres) : "this centre"}?`, message: "The money is transferred to the centre's bank account. This can't be undone.", confirmLabel: "Send payout", danger: true }))) return;
    if (!(await requireStepUp("Confirm sending this payout"))) { setMsg(""); return setErr("Not confirmed. Nothing was sent."); }
    await act("Sending payout…", { action: "send", payout_id: p.id });
  };
  const cancel = async (p: any) => {
    if (await confirm({ title: "Cancel this draft payout?", message: `The ${naira(p.amount)} draft for ${p.centres ? placeLabel(p.centres) : "this centre"} is discarded. The director can ask again.`, confirmLabel: "Cancel payout", cancelLabel: "Keep it", danger: true })) await act("Cancelling payout…", { action: "cancel", payout_id: p.id });
  };

  return (
    <View style={{ gap: 16 }}>
      <Heading size={26} lh={32}>Payouts</Heading>
      <Segmented value={tab} onChange={setTab} options={[{ value: "centres", label: "Centres" }, { value: "instructors", label: "Instructors" }]} />
      {tab === "instructors" ? <InstructorPayouts /> : <>
      <Text size={14} tone="muted">{"Directors ask to withdraw a month at a time. Review each request, then send it to the centre's bank account."}</Text>
      {msg ? <View style={{ borderRadius: radius.xl, backgroundColor: th.a("ok", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="ok">{msg}</Text></View> : null}
      <Err>{err || loadErr}</Err>
      {!rows ? <Skeleton height={96} /> : rows.length === 0 ? <Empty title="No payouts yet." /> : rows.map((p) => (
        <Card key={p.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={20} weight="semibold" num>{naira(p.amount)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>{p.centres ? <Place centre={p.centres} nameOnly size={14} tone="muted" /> : null}{p.period_month ? <Text size={14} tone="muted">{` · ${fmtDay(p.period_month, { month: "long", year: "numeric" })}`}</Text> : null}</View>
            </View>
            <Badge tone={tone(p.status)}>{p.status}</Badge>
          </View>
          {p.failure_reason ? <Text size={14} tone="bad">{p.failure_reason}</Text> : null}
          {p.status === "draft" && <View style={{ flexDirection: "row", gap: 8 }}><Button style={{ height: 40, flex: 1 }} onPress={() => send(p)}>{`Send ${naira(p.amount)}`}</Button><Button variant="secondary" style={{ height: 40 }} onPress={() => cancel(p)}>Cancel</Button></View>}
        </Card>))}
      </>}
    </View>
  );
}
