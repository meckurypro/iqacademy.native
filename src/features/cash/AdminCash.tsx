// Admins: cash that centres hold, transfers to review (approve once the money is in the academy account), cash an admin collected from centres,
// and the hand-over PIN a centre needs to hand cash to you. A super admin also reviews admins' own transfers. Port of web pages/CashAdmin.tsx @feaca5e.
// Approving and declining move money, so they are online-only and behind the step-up check (M12), like the other admin money screens.
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/core/auth";
import { friendly, naira } from "@/core/errors";
import { mutateRpc, useRpc } from "@/data";
import type { PickedReceipt } from "@/features/enrol/receiptDevice";
import { requireStepUp } from "@/features/security/stepUp";
import { ChangePinForm, PinSetup } from "@/features/student/Pin";
import { place } from "@/shared/web/centre";
import { fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Avatar, Badge, Button, Card, Chip, Empty, Err, Field, Heading, Icon, List, PageHeader, Section, Sheet, Skeleton, Stat, Text, useFeedback } from "@/ui";
import { CASH_TAGS, DECLINE_REASONS, LEG_LABEL, pickedTotal, type AdminCash as Data, type ReviewRow } from "./cash";
import { BankCard, PickItems, ReceiptField, type Pickable } from "./CashParts";
import { newRemittanceId, removeReceipt, signedReceiptUrl, uploadRemitReceipt } from "./receiptUpload";

function Panel({ children }: { children: React.ReactNode }) {
  const { p } = useTheme();
  return <View style={{ borderRadius: radius["2xl"], borderWidth: 1, borderColor: p.c.line, overflow: "hidden" }}>{children}</View>;
}
const when = (d: string) => fmtWhen(d, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

type TProps = { onClose: () => void; data: Data; onDone: () => void };
function AdminTransferSheet(p: TProps & { open: boolean }) { return <Sheet open={p.open} onClose={p.onClose}><TransferBody onClose={p.onClose} data={p.data} onDone={p.onDone} /></Sheet>; }

function TransferBody({ onClose, data, onDone }: TProps) {
  const { session } = useAuth(); const { run } = useFeedback();
  const items = useMemo<Pickable[]>(() => data.mine.items.map((i) => ({ id: i.payment_id, title: i.student_name, sub: `${i.centre_name} · ${i.reference}`, amount: i.amount, when: i.collected_at })), [data]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items.map((i) => i.id))); const [file, setFile] = useState<PickedReceipt | null>(null); const [note, setNote] = useState(""); const [err, setErr] = useState("");
  const total = pickedTotal(items, picked);
  const send = async () => {
    if (!file || !session || !picked.size) return;
    setErr("");
    const rid = newRemittanceId();
    const r = await run("Sending your receipt…", async () => {
      const up = await uploadRemitReceipt(session.user.id, rid, file);
      try { await mutateRpc("cash_remit_admin_transfer", { p_remittance_id: rid, p_payment_ids: [...picked], p_path: up.path, p_name: up.name, p_mime: up.mime, p_size: up.size, p_note: note.trim() || null }, { invalidates: CASH_TAGS }); }
      catch (e) { await removeReceipt(up.path); throw e; }
    }, { success: "Sent. A super admin will confirm it.", quiet: true });
    if (!r.ok) return setErr(r.message);
    onDone(); onClose();
  };
  return (
    <View style={{ gap: 16 }}>
      <Heading size={20} lh={28}>Send the cash you hold</Heading>
        <Text size={14} tone="muted">Transfer exactly what you are sending to the academy account, then add the bank receipt. A super admin approves it.</Text>
        <PickItems items={items} picked={picked} onChange={setPicked} />
        <BankCard bank={data.bank} title={`Transfer ${naira(total)} to`} />
        <ReceiptField file={file} setFile={setFile} note={note} setNote={setNote} onError={setErr} />
        <Err>{err}</Err>
        <Button disabled={!file || !picked.size} onPress={send}>{`Send receipt for ${naira(total)}`}</Button>
    </View>
  );
}

export default function AdminCash() {
  const { p } = useTheme(); const { run, confirm } = useFeedback();
  const q = useRpc<Data>("admin_cash_overview", {}, { tags: ["cash", "payments"], ttlMs: 15_000 });
  const d = q.data; const loadErr = q.error && !d ? "Couldn't load cash. Check your connection and try again." : q.error ? friendly(q.error) : "";
  const [view, setView] = useState<{ r: ReviewRow; url: string | null; loading: boolean } | null>(null);
  const [decl, setDecl] = useState<{ r: ReviewRow; reason: string } | null>(null);
  const [xfer, setXfer] = useState(false); const [pin, setPin] = useState(false);
  const load = () => { void q.refetch(); };

  const open = async (r: ReviewRow) => {
    setView({ r, url: null, loading: !!r.receipt });
    if (!r.receipt) return;
    try { const url = await signedReceiptUrl(r.receipt.path); setView((v) => (v && v.r.id === r.id ? { ...v, url, loading: false } : v)); }
    catch { setView((v) => (v && v.r.id === r.id ? { ...v, loading: false } : v)); }
  };
  const approve = async (r: ReviewRow) => {
    const who = r.leg === "centre_transfer" ? (r.centre_name ?? "the centre") : r.submitted_by_name;
    if (!(await confirm({ title: `Confirm ${naira(r.amount)} received?`, confirmLabel: "Yes, approve",
      message: `Approve only when ${naira(r.amount)} from ${who} is in the academy account (reference ${r.reference}). ${r.leg === "centre_transfer" ? "The centre's share of these payments is then added to its balance." : ""}` }))) return;
    if (!(await requireStepUp("Confirm approving this cash transfer"))) return;
    const res = await run("Approving…", async () => { await mutateRpc("approve_cash_remittance", { p_remittance_id: r.id }, { invalidates: CASH_TAGS }); }, { success: "Approved" });
    if (res.ok) { setView(null); load(); }
  };
  const decline = async () => {
    if (!decl) return;
    if (!(await requireStepUp("Confirm declining this cash transfer"))) return;
    const res = await run("Declining…", async () => { await mutateRpc("decline_cash_remittance", { p_remittance_id: decl.r.id, p_reason: decl.reason }, { invalidates: CASH_TAGS }); }, { success: "Declined. The sender has been told." });
    if (res.ok) { setDecl(null); setView(null); load(); }
  };

  if (!d) return loadErr ? <Err>{loadErr}</Err> : <View style={{ gap: 12 }}><Skeleton height={32} /><Skeleton height={96} /><Skeleton height={128} /></View>;
  const mine = d.mine;
  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Cash from centres" sub="Cash students paid at a centre, on its way to the academy account" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Stat compact tone="warn" label="With centres" value={naira(d.totals.at_centres)} /></View>
        <View style={{ flex: 1 }}><Stat compact tone="info" label="With admins" value={naira(d.totals.with_admins)} /></View>
        <View style={{ flex: 1 }}><Stat compact tone="ok" label="Received" value={naira(d.totals.settled)} /></View>
      </View>

      <Section title="To review" aside={<Text size={14} tone="muted" num>{d.reviews.length}</Text>}>
        {d.reviews.length === 0 ? <Empty icon="checkCircle" title="Nothing to review" hint="Transfers with a receipt appear here." /> : d.reviews.map((r) => (
          <Card key={r.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="medium">{r.leg === "centre_transfer" ? place({ name: r.centre_name ?? "Centre", city: r.centre_city }) : `Admin: ${r.submitted_by_name}`}</Text>
                <Text size={14} tone="muted">{LEG_LABEL[r.leg]} · {r.items.length} payment{r.items.length === 1 ? "" : "s"} · {r.reference}</Text>
                {r.leg === "centre_transfer" ? <Text size={14} tone="muted">Sent by {r.submitted_by_name} · {when(r.created_at)}</Text> : null}
              </View>
              <Text size={18} weight="semibold" num>{naira(r.amount)}</Text>
            </View>
            {r.note ? <View style={{ borderRadius: radius.xl, backgroundColor: p.c.sunken, paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14}>“{r.note}”</Text></View> : null}
            {r.can_act ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button variant="secondary" style={{ flex: 1, height: 44, paddingHorizontal: 8 }} onPress={() => open(r)}>Receipt</Button>
                <Button variant="secondary" style={{ flex: 1, height: 44, paddingHorizontal: 8 }} onPress={() => setDecl({ r, reason: "" })}>Decline</Button>
                <Button style={{ flex: 1, height: 44, paddingHorizontal: 8 }} onPress={() => approve(r)}>Approve</Button>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Badge tone="info">{r.leg === "admin_transfer" ? "Waiting for a super admin" : "Sent by you"}</Badge>
                <Button variant="secondary" style={{ height: 40, paddingHorizontal: 16 }} onPress={() => open(r)}>Receipt</Button>
              </View>)}
          </Card>))}
      </Section>

      <Section title="Cash you hold">
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}><Text size={24} weight="semibold" num>{naira(mine.holding)}</Text><Text size={14} tone="muted">collected from centres{mine.in_review > 0 ? ` · ${naira(mine.in_review)} under review` : ""}</Text></View>
            <Button style={{ height: 40, paddingHorizontal: 16 }} disabled={mine.holding <= 0} onPress={() => setXfer(true)}>Send to academy</Button>
          </View>
          {mine.items.length > 0 && <Panel>{mine.items.slice(0, 6).map((i, n) => (
            <View key={i.payment_id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: n ? 1 : 0, borderTopColor: p.c.line }}>
              <Text size={14} numberOfLines={1} style={{ flex: 1 }}>{i.student_name}<Text size={14} tone="muted">{` · ${i.centre_name}`}</Text></Text><Text size={14} weight="medium" num>{naira(i.amount)}</Text>
            </View>))}
            {mine.items.length > 6 ? <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: p.c.line }}><Text size={14} tone="muted">and {mine.items.length - 6} more</Text></View> : null}</Panel>}
          {mine.incoming.map((i) => <View key={i.id} style={{ borderRadius: radius.xl, backgroundColor: p.a("info", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="info">{i.centre_name} is handing you {naira(i.amount)} ({i.reference}). Count it, then type your PIN on their phone.</Text></View>)}
        </Card>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="lock" size={22} color={p.c.muted} />
          <View style={{ flex: 1 }}><Text weight="medium">Hand-over PIN</Text><Text size={14} tone="muted">{mine.has_pin ? "Set. You type it on a coordinator's phone to confirm you received their cash." : "Not set. Set one so a centre can hand cash to you."}</Text></View>
          <Button variant="secondary" style={{ height: 36, paddingHorizontal: 16 }} onPress={() => setPin(true)}>{mine.has_pin ? "Change" : "Set PIN"}</Button>
        </Card>
      </Section>

      {d.is_super && d.holders.length > 0 && <Section title="Admins holding cash">
        <List>{d.holders.map((h) => (
          <View key={h.admin_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Avatar name={h.name} size={32} /><Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>{h.name}</Text>
            <View style={{ alignItems: "flex-end" }}><Text weight="semibold" num>{naira(h.holding)}</Text>{h.in_review > 0 ? <Text size={12} tone="muted">{naira(h.in_review)} under review</Text> : null}</View>
          </View>))}</List>
      </Section>}

      <Section title="Centres holding cash">
        {d.centres.length === 0 ? <Text size={14} tone="muted">No centre is holding cash right now.</Text> : <List>{d.centres.map((c) => (
          <View key={c.centre_id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{place({ name: c.name, city: c.city })}</Text>
              <Text size={13} tone="muted" numberOfLines={1}>{c.oldest ? `Oldest cash from ${fmtWhen(c.oldest, { day: "numeric", month: "short" })}` : "Nothing left to send"}{c.in_review + c.handover_pending > 0 ? ` · ${naira(c.in_review + c.handover_pending)} on its way` : ""}</Text></View>
            <Text weight="semibold" num tone={c.at_centre > 0 ? "warn" : "ink"}>{naira(c.at_centre)}</Text>
          </View>))}</List>}
      </Section>

      {d.recent.length > 0 && <Section title="Recently handled">
        <List>{d.recent.slice(0, 10).map((r) => (
          <View key={r.id} style={{ gap: 2, paddingHorizontal: 16, paddingVertical: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>{r.leg === "admin_transfer" ? `Admin: ${r.submitted_by_name}` : r.centre_name}{r.to_admin_name ? ` → ${r.to_admin_name}` : ""}</Text><Text weight="semibold" num>{naira(r.amount)}</Text></View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text size={13} tone="muted" numberOfLines={1} style={{ flex: 1 }}>{LEG_LABEL[r.leg]} · {r.reference}{r.decided_at ? ` · ${when(r.decided_at)}` : ""}</Text><Badge tone={r.status === "approved" ? "ok" : r.status === "declined" ? "bad" : "muted"}>{r.status}</Badge></View>
            {r.status === "declined" && r.decision_note ? <Text size={14} tone="muted">{r.decision_note}</Text> : null}
          </View>))}</List>
      </Section>}

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${naira(view.r.amount)} · ${view.r.reference}` : ""}>
        {view && <View style={{ gap: 12 }}>
          {view.loading ? <Skeleton height={240} />
            : !view.url ? <Text tone="muted">{"Couldn't load the receipt."}</Text>
            : view.r.receipt?.mime.startsWith("image/") ? <Pressable accessibilityRole="imagebutton" accessibilityLabel="Receipt. Tap to open full size" onPress={() => WebBrowser.openBrowserAsync(view.url!)}><Image source={{ uri: view.url }} contentFit="contain" style={{ width: "100%", height: 320, borderRadius: radius.xl, backgroundColor: p.c.sunken }} /></Pressable>
            : <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(view.url!)} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.xl, backgroundColor: p.c.sunken, paddingHorizontal: 16, paddingVertical: 16 }}><Icon name="file" size={18} color={p.c.accent} /><Text tone="accent" numberOfLines={1} style={{ flex: 1 }}>Open {view.r.receipt?.name}</Text></Pressable>}
          <Panel>{view.r.items.map((i, n) => (
            <View key={i.reference} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: n ? 1 : 0, borderTopColor: p.c.line }}>
              <Text size={14} numberOfLines={1} style={{ flex: 1 }}>{i.student_name}<Text size={14} tone="muted">{` · ${i.reference}`}</Text></Text><Text size={14} weight="medium" num>{naira(i.amount)}</Text>
            </View>))}</Panel>
          <Text size={14} tone="muted">Check the amount against your bank alert before approving.</Text>
          {view.r.can_act && <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => { const r = view.r; setView(null); setDecl({ r, reason: "" }); }}>Decline</Button>
            <Button style={{ flex: 1 }} onPress={() => approve(view.r)}>Approve</Button></View>}
        </View>}
      </Sheet>

      <Sheet open={!!decl} onClose={() => setDecl(null)} title="Decline this transfer">
        {decl && <View style={{ gap: 12 }}>
          <Text size={14} tone="muted">{naira(decl.r.amount)} · {decl.r.reference}. The sender is told why and the cash goes back on their list.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{DECLINE_REASONS.map((x) => <Chip key={x} on={decl.reason === x} onPress={() => setDecl({ ...decl, reason: x })}>{x}</Chip>)}</View>
          <Field label="Reason (shown to the sender)" value={decl.reason} maxLength={300} onChangeText={(v) => setDecl({ ...decl, reason: v })} />
          <Button variant="danger" disabled={decl.reason.trim().length < 3} onPress={decline}>Decline transfer</Button>
        </View>}
      </Sheet>

      <AdminTransferSheet open={xfer} onClose={() => setXfer(false)} data={d} onDone={load} />
      <Sheet open={pin} onClose={() => setPin(false)} title={mine.has_pin ? "Change your hand-over PIN" : "Set your hand-over PIN"}>
        <View style={{ gap: 16 }}>
          <Text size={14} tone="muted">Only you should know it. Centres use it to hand you cash: you type it on their phone after counting.</Text>
          {mine.has_pin ? <ChangePinForm staff onDone={() => { setPin(false); load(); }} /> : <PinSetup staff onDone={() => { setPin(false); load(); }} />}
        </View>
      </Sheet>
    </View>
  );
}
