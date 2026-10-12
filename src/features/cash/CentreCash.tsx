// A centre's cash: record a student's cash payment, see what the centre holds, and get it to IQ Academy either by bank transfer
// (upload the receipt, an admin approves) or by handing it to an admin, who types their PIN on this phone. Port of web pages/CashCentre.tsx @feaca5e.
// Everything here moves money, so it is online-only (no queue).
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useAuth } from "@/core/auth";
import { friendly, naira } from "@/core/errors";
import { mutateRpc, online, useRpc } from "@/data";
import type { PickedReceipt } from "@/features/enrol/receiptDevice";
import { place } from "@/shared/web/centre";
import { fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Badge, Button, Card, Empty, Err, Field, Heading, Icon, List, PageHeader, PIN_LENGTH, PinInput, Section, Sheet, Skeleton, Stat, Text, useFeedback } from "@/ui";
import { BranchChips } from "@/features/staff/common";
import { useStaffCentres } from "@/features/staff/useStaffCentres";
import { CASH_TAGS, LEG_LABEL, STAGE_LABEL, handoverReply, pickedTotal, type CashStage, type CentreCash as Data, type CentreRemittance, type FoundAdmin } from "./cash";
import { BankCard, PickItems, ReceiptField, type Pickable } from "./CashParts";
import RecordCashSheet from "./RecordCashSheet";
import { newRemittanceId, removeReceipt, uploadRemitReceipt } from "./receiptUpload";

const STAGE_TONE: Record<CashStage, "warn" | "info" | "ok"> = { at_centre: "warn", transfer_pending: "info", handover_pending: "info", with_admin: "ok", admin_transfer_pending: "ok", settled: "ok" };
const when = (d: string) => fmtWhen(d, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
type Resume = { id: string; amount: number; admin_name: string };
const toItems = (d: Data): Pickable[] => d.collections.filter((c) => c.stage === "at_centre").map((c) => ({ id: c.payment_id, title: c.student_name, sub: c.reference, amount: c.amount, when: c.collected_at }));
const Pad = ({ children }: { children: React.ReactNode }) => <View style={{ gap: 16 }}>{children}</View>;

type SheetProps = { open: boolean; onClose: () => void; data: Data; centreId: string; onDone: () => void };

/** Each sheet keeps its form in a body that mounts when the sheet opens, so it always starts empty. */
function TransferSheet(p: SheetProps) { return <Sheet open={p.open} onClose={p.onClose}><TransferBody {...p} /></Sheet>; }

function TransferBody({ onClose, data, centreId, onDone }: SheetProps) {
  const { session } = useAuth(); const { run } = useFeedback();
  const items = useMemo(() => toItems(data), [data]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items.map((i) => i.id))); const [file, setFile] = useState<PickedReceipt | null>(null); const [note, setNote] = useState(""); const [err, setErr] = useState("");
  const total = pickedTotal(items, picked);
  const send = async () => {
    if (!file || !session || !picked.size) return;
    setErr("");
    const rid = newRemittanceId();
    const r = await run("Sending your receipt…", async () => {
      const up = await uploadRemitReceipt(session.user.id, rid, file);
      try { await mutateRpc("cash_remit_transfer", { p_remittance_id: rid, p_centre_id: centreId, p_payment_ids: [...picked], p_path: up.path, p_name: up.name, p_mime: up.mime, p_size: up.size, p_note: note.trim() || null }, { invalidates: CASH_TAGS }); }
      catch (e) { await removeReceipt(up.path); throw e; }
    }, { success: "Sent. An admin will confirm it once the money shows in the account.", quiet: true });
    if (!r.ok) return setErr(r.message);
    onDone(); onClose();
  };
  return (
    <Pad>
      <Heading size={20} lh={28}>Send cash by bank transfer</Heading>
        <Text size={14} tone="muted">1. Choose the cash you are sending. 2. Transfer exactly that amount to the academy account. 3. Add the bank receipt.</Text>
        <PickItems items={items} picked={picked} onChange={setPicked} />
        <BankCard bank={data.bank} title={`Transfer ${naira(total)} to`} />
        <ReceiptField file={file} setFile={setFile} note={note} setNote={setNote} onError={setErr} />
        <Err>{err}</Err>
        <Button disabled={!file || !picked.size} onPress={send}>{`Send receipt for ${naira(total)}`}</Button>
    </Pad>
  );
}

function HandoverSheet(p: SheetProps & { resume: Resume | null }) { return <Sheet open={p.open} onClose={p.onClose}><HandoverBody {...p} /></Sheet>; }

function HandoverBody({ onClose, data, centreId, resume, onDone }: SheetProps & { resume: Resume | null }) {
  const { p } = useTheme(); const { run, confirm } = useFeedback();
  const items = useMemo(() => toItems(data), [data]);
  const [stage, setStage] = useState<"admin" | "pin" | "done">(resume ? "pin" : "admin");
  const [q, setQ] = useState(""); const [admins, setAdmins] = useState<FoundAdmin[] | null>(null); const [admin, setAdmin] = useState<FoundAdmin | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items.map((i) => i.id))); const [started, setStarted] = useState<Resume | null>(resume);
  const [pin, setPin] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const search = async () => {
    setErr(""); setBusy(true);
    try { setAdmins(await online(async (sb) => { const r = await sb.rpc("cash_find_admin", { p_centre_id: centreId, p_query: q }); if (r.error) throw r.error; return (r.data as FoundAdmin[]) ?? []; })); }
    catch (e) { setErr(friendly(e)); } finally { setBusy(false); }
  };
  const begin = async () => {
    if (!admin || !picked.size) return;
    setErr("");
    const r = await run("Starting the hand-over…", async () => {
      const m = await mutateRpc<{ id: string; amount: number; admin_name: string }>("cash_start_handover", { p_centre_id: centreId, p_admin_id: admin.id, p_payment_ids: [...picked] }, { invalidates: CASH_TAGS });
      if (m.status !== "done") throw new Error("not_saved");
      return m.data;
    }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    setStarted({ id: r.data.id, amount: r.data.amount, admin_name: r.data.admin_name }); setStage("pin"); onDone();
  };
  const check = async (v: string) => {
    if (!started || busy) return;
    setBusy(true); setErr("");
    try {
      const res = (await mutateRpc<string>("cash_confirm_handover", { p_remittance_id: started.id, p_pin: v }, { invalidates: CASH_TAGS }));
      const code = res.status === "done" ? String(res.data) : "";
      if (code === "ok") { setStage("done"); onDone(); return; }
      setPin(""); setErr(handoverReply(code)); if (code === "handover_voided") onDone();
    } catch (e) { setPin(""); setErr(friendly(e)); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!started) return;
    if (!(await confirm({ title: "Cancel this hand-over?", message: "The cash goes back on your list. Nothing has been handed over.", confirmLabel: "Cancel hand-over", cancelLabel: "Keep it", danger: true }))) return;
    const r = await run("Cancelling…", async () => { await mutateRpc("cash_cancel_remittance", { p_remittance_id: started.id }, { invalidates: CASH_TAGS }); }, { success: "Hand-over cancelled" });
    if (r.ok) { onDone(); onClose(); }
  };
  const total = pickedTotal(items, picked);

  return (
    <Pad>
      <Heading size={20} lh={28}>{stage === "done" ? "Cash handed over" : "Hand cash to an admin"}</Heading>
        {stage === "admin" && <>
          <Text size={14} tone="muted">Use this when an admin is at the centre to collect the cash. They count it, then type their own PIN on this phone to confirm.</Text>
          <PickItems items={items} picked={picked} onChange={setPicked} />
          <Field label="Admin" value={q} onChangeText={(v) => { setQ(v); setAdmins(null); setAdmin(null); }} onSubmitEditing={() => q.trim().length >= 3 && search()} placeholder="Their email or name" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
          <Button variant="secondary" disabled={q.trim().length < 3} loading={busy} onPress={search}>Find admin</Button>
          {admins && (admins.length === 0 ? <Text size={14} tone="muted">No admin matches that.</Text> : admins.map((a) => (
            <Pressable key={a.id} accessibilityRole="button" accessibilityState={{ selected: admin?.id === a.id, disabled: !a.has_pin }} disabled={!a.has_pin} onPress={() => setAdmin(a)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, padding: 12, borderRadius: radius["2xl"], backgroundColor: admin?.id === a.id ? p.a("accent", 0.1) : p.c.surface, borderWidth: admin?.id === a.id ? 2 : 1, borderColor: admin?.id === a.id ? p.c.accent : p.c.line, opacity: a.has_pin ? 1 : 0.6 }}>
              <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{a.full_name}</Text><Text size={14} tone="muted">{a.has_pin ? a.email : "Hasn't set a hand-over PIN yet. Ask them to set it on their Cash screen."}</Text></View>
              {admin?.id === a.id ? <Icon name="check" size={18} color={p.c.accent} /> : null}
            </Pressable>)))}
          <Err>{err}</Err>
          <Button disabled={!admin || !picked.size} onPress={begin}>{`Hand over ${naira(total)}`}</Button>
        </>}
        {stage === "pin" && started && <>
          <Card style={{ alignItems: "center", gap: 4 }}><Text size={14} tone="muted">{started.admin_name} is receiving</Text><Text size={30} weight="semibold" num>{naira(started.amount)}</Text></Card>
          <Text size={14} tone="muted" align="center">Hand over the cash. {started.admin_name.split(" ")[0]} counts it, then types their PIN here.</Text>
          <PinInput value={pin} onChange={(v) => { setPin(v); setErr(""); }} autoFocus invalid={!!err} disabled={busy} onComplete={check} />
          <Err>{err}</Err>
          <Button variant="ghost" disabled={pin.length > 0 && pin.length < PIN_LENGTH} onPress={cancel}>Cancel hand-over</Button>
        </>}
        {stage === "done" && started && <View style={{ gap: 16, alignItems: "center", paddingVertical: 8 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: p.a("ok", 0.15) }}><Icon name="check" size={32} color={p.c.ok} /></View>
          <Text size={18} weight="semibold" align="center">{naira(started.amount)} handed to {started.admin_name}</Text>
          <Text size={14} tone="muted" align="center">Your centre no longer holds this cash, and your share has been added to your balance.</Text>
          <Button style={{ alignSelf: "stretch" }} onPress={onClose}>Done</Button>
        </View>}
    </Pad>
  );
}

export default function CentreCash() {
  const { p } = useTheme(); const { run, confirm } = useFeedback();
  const { ids, centres, sel, setSel } = useStaffCentres();
  const centreId = sel !== "all" ? sel : ids[0];
  const q = useRpc<Data>("cash_centre_summary", { p_centre_id: centreId }, { enabled: !!centreId, tags: ["cash", "payments"], ttlMs: 15_000 });
  const data = q.data; const err = q.error ? friendly(q.error) : "";
  const [rec, setRec] = useState(false); const [xfer, setXfer] = useState(false); const [hand, setHand] = useState(false); const [resume, setResume] = useState<Resume | null>(null);
  const load = () => { void q.refetch(); };

  const cancel = async (r: CentreRemittance) => {
    if (!(await confirm({ title: "Cancel this?", message: "The cash goes back on your list.", confirmLabel: "Cancel it", cancelLabel: "Keep it", danger: true }))) return;
    const res = await run("Cancelling…", async () => {
      const m = await mutateRpc<{ receipt_path: string | null }>("cash_cancel_remittance", { p_remittance_id: r.id }, { invalidates: CASH_TAGS });
      if (m.status === "done") await removeReceipt(m.data?.receipt_path);
    }, { success: "Cancelled" });
    if (res.ok) load();
  };

  if (centres && ids.length === 0) return <Empty icon="cash" title="No centre yet" hint="Cash is handled by the coordinator or director of a centre." />;
  const held = data?.totals.at_centre ?? 0;
  const waiting = (data?.remittances ?? []).filter((r) => r.status === "pending");
  const handled = (data?.remittances ?? []).filter((r) => r.status !== "pending").slice(0, 8);
  const centreName = data ? place(data.centre) : "";

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Cash" sub="Cash students pay at the centre" action={centreId ? <Button style={{ height: 40, paddingHorizontal: 16 }} onPress={() => setRec(true)}>Record cash</Button> : undefined} />
      {ids.length > 1 && <BranchChips centres={centres} sel={centreId ?? ""} setSel={setSel} all={false} />}
      <Err>{err}</Err>
      {!data ? (err ? null : <View style={{ gap: 12 }}><Skeleton height={96} /><Skeleton height={128} /></View>) : <>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Stat compact tone="warn" label="You hold" value={naira(held)} sub="Owed to the academy" /></View>
          <View style={{ flex: 1 }}><Stat compact tone="info" label="Being checked" value={naira(data.totals.in_review + data.totals.handover_pending)} sub="Sent, not confirmed" /></View>
          <View style={{ flex: 1 }}><Stat compact tone="ok" label="Handed over" value={naira(data.totals.handed_over)} sub="All time" /></View>
        </View>

        {held > 0 && <Section title="Send it to IQ Academy">
          <Card style={{ gap: 12 }}>
            <Text size={14} tone="muted">Your centre’s share of each payment is added to your balance once the cash has been handed over.</Text>
            <View style={{ flexDirection: "row", gap: 8 }}><Button style={{ flex: 1 }} onPress={() => setXfer(true)}>Bank transfer</Button><Button variant="secondary" style={{ flex: 1 }} onPress={() => { setResume(null); setHand(true); }}>Hand to an admin</Button></View>
          </Card>
        </Section>}

        {waiting.length > 0 && <Section title="Waiting">
          <List>{waiting.map((r) => (
            <View key={r.id} style={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{r.leg === "handover" ? `Hand-over to ${r.to_admin_name ?? "an admin"}` : "Bank transfer sent"}</Text><Text size={14} tone="muted">{r.reference} · {when(r.created_at)}</Text></View>
                <Text weight="semibold" num>{naira(r.amount)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="info">{r.leg === "handover" ? "Waiting for their PIN" : "Waiting for an admin to confirm"}</Badge>
                {r.leg === "handover" && <Button style={{ height: 36, paddingHorizontal: 12 }} onPress={() => { setResume({ id: r.id, amount: r.amount, admin_name: r.to_admin_name ?? "The admin" }); setHand(true); }}>Enter PIN</Button>}
                <Pressable accessibilityRole="button" onPress={() => cancel(r)} style={{ marginLeft: "auto", minHeight: 44, justifyContent: "center" }}><Text size={14} tone="muted" style={{ textDecorationLine: "underline" }}>Cancel</Text></Pressable>
              </View>
            </View>))}</List>
        </Section>}

        <Section title="Cash received" aside={<Text size={14} tone="muted" num>{data.collections.length}</Text>}>
          {data.collections.length === 0 ? <Empty icon="cash" title="No cash recorded yet" hint="When a student pays cash at the centre, tap Record cash." />
            : <List>{data.collections.slice(0, 25).map((c) => (
              <View key={c.payment_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{c.student_name}</Text><Text size={13} tone="muted" numberOfLines={1}>{c.reference} · {when(c.collected_at)} · {c.collected_by}</Text></View>
                <View style={{ alignItems: "flex-end", gap: 4 }}><Text weight="semibold" num>{naira(c.amount)}</Text><Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge></View>
              </View>))}</List>}
        </Section>

        {handled.length > 0 && <Section title="Sent to IQ Academy">
          <List>{handled.map((r) => (
            <View key={r.id} style={{ gap: 4, paddingHorizontal: 16, paddingVertical: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>{LEG_LABEL[r.leg]}{r.to_admin_name ? ` · ${r.to_admin_name}` : ""}</Text><Text weight="semibold" num>{naira(r.amount)}</Text></View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text size={13} tone="muted" numberOfLines={1} style={{ flex: 1 }}>{r.reference} · {when(r.decided_at ?? r.created_at)}</Text>
                <Badge tone={r.status === "approved" ? "ok" : r.status === "declined" ? "bad" : "muted"}>{r.status === "approved" ? (r.leg === "handover" ? "Handed over" : "Confirmed") : r.status === "declined" ? "Not confirmed" : "Cancelled"}</Badge></View>
              {r.status === "declined" && r.decision_note ? <Text size={14} style={{ color: p.c.bad }}>{r.decision_note}. The cash is back on your list.</Text> : null}
            </View>))}</List>
        </Section>}

        <RecordCashSheet open={rec} onClose={() => setRec(false)} centreId={centreId!} centreName={centreName} onDone={load} />
        <TransferSheet open={xfer} onClose={() => setXfer(false)} data={data} centreId={centreId!} onDone={load} />
        <HandoverSheet open={hand} onClose={() => { setHand(false); load(); }} data={data} centreId={centreId!} resume={resume} onDone={load} />
      </>}
    </View>
  );
}
