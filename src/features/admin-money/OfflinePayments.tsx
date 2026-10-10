// Port of web pages/OfflinePayments.tsx. Admin: offline payments waiting for review. Approve once the money has arrived (the student is notified and their classes unlock),
// decline with a reason (optionally removing the registration), or leave it until the money shows up. Approving, declining and changing where students pay all move or
// redirect money, so they are online-only and behind the step-up check (M12). Receipts open through a short-lived signed link.
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { Redirect } from "expo-router";
import { useAuth } from "@/core/auth";
import { friendly, naira } from "@/core/errors";
import { online, useRpc } from "@/data";
import { requireStepUp } from "@/features/security/stepUp";
import type { OfflineDetails, Receipt } from "@/shared/offline";
import { place } from "@/shared/web/centre";
import { now } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Area, Avatar, Badge, Button, Card, Chip, Empty, Err, Field, Heading, Icon, Segmented, Sheet, Skeleton, SwitchRow, Text, useFeedback } from "@/ui";

type Row = {
  id: string; reference: string; status: "pending" | "succeeded" | "failed"; amount: number; created_at: string; updated_at: string;
  student_name: string; student_phone: string | null; student_email: string | null; centre_name: string; centre_city: string | null;
  package: string; plan: string; enrolment_status: string; instalment_number: number | null; instalment_label: string | null; instalments_total: number;
  courses: string[]; receipt: Receipt | null; student_note: string | null; failed_reason: string | null; admin_note: string | null;
};
const ago = (iso: string) => {
  const m = Math.round((now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : `${d} days ago`;
};
const REASONS = ["Money not received", "Amount doesn't match", "Receipt unreadable"];
const BUCKET = "payment-receipts";

export default function OfflinePayments() {
  const { p } = useTheme(); const { roles } = useAuth(); const { run, confirm } = useFeedback();
  const isAdmin = roles.some((r) => r.role === "admin" || r.role === "super_admin");
  const [tab, setTab] = useState<"open" | "handled">("open");
  const [editBank, setEditBank] = useState<OfflineDetails | null>(null); const [view, setView] = useState<{ row: Row; url: string | null; loading: boolean } | null>(null);
  const [decl, setDecl] = useState<{ row: Row; reason: string; purge: boolean } | null>(null);
  const lq = useRpc<Row[]>("admin_offline_payments", { p_view: tab }, { enabled: isAdmin, tags: ["payments"], ttlMs: 20_000 });
  const dq = useRpc<OfflineDetails>("offline_payment_details", {}, { enabled: isAdmin, tags: ["payments"], ttlMs: 60_000 });
  const rows = lq.data; const bank = dq.data ?? {}; const loadErr = lq.error && !rows ? "Couldn't load the list. Check your connection and try again." : lq.error ? friendly(lq.error) : "";
  if (!isAdmin) return <Redirect href="/" />;
  const reload = () => { void lq.refetch(); void dq.refetch(); };

  const openReceipt = async (r: Row) => {
    setView({ row: r, url: null, loading: !!r.receipt });
    if (!r.receipt) return;
    try {
      const url = await online(async (sb) => { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(r.receipt!.path, 300); if (error) throw error; return data.signedUrl; });
      setView((v) => (v && v.row.id === r.id ? { ...v, url, loading: false } : v));
    } catch { setView((v) => (v && v.row.id === r.id ? { ...v, loading: false } : v)); }
  };
  const approve = async (r: Row) => {
    if (!(await confirm({ title: `Confirm ${naira(r.amount)} received?`, message: `Only approve once the money from ${r.student_name} has reached you (reference ${r.reference}). They'll be told their payment was received and their classes unlock.`, confirmLabel: "Yes, approve" }))) return;
    if (!(await requireStepUp("Confirm approving this payment"))) return;
    const res = await run("Approving payment…", () => online(async (sb) => {
      const { error } = await sb.rpc("approve_offline_payment", { p_payment_id: r.id }); if (error) throw error;
      // Read it back: only call it approved if the payment really shows as paid.
      const back = await sb.from("payments").select("status").eq("id", r.id).single();
      if (back.error || back.data?.status !== "succeeded") throw new Error("not_saved");
    }, { invalidates: ["payments", "enrolments"] }), { success: `Approved. ${r.student_name.split(" ")[0]} has been notified.` });
    if (res.ok) { setView(null); reload(); }
  };
  const decline = async () => {
    if (!decl) return;
    const { row, reason, purge } = decl;
    if (!(await requireStepUp("Confirm declining this payment"))) return;
    const res = await run(purge ? "Declining and cancelling…" : "Declining…", () => online(async (sb) => {
      const { data, error } = await sb.rpc("decline_offline_payment", { p_payment_id: row.id, p_reason: reason, p_cancel_registration: purge });
      if (error) throw error;
      const path = (data as { receipt_path: string | null; cancelled: boolean }).receipt_path;
      if (purge && path) await sb.storage.from(BUCKET).remove([path]); // the receipt goes with the registration; best effort
    }, { invalidates: ["payments", "enrolments"] }), { success: purge ? "Declined and removed. The student has been told." : "Declined. The student has been told and can pay again." });
    if (res.ok) { setDecl(null); setView(null); reload(); }
  };
  const saveBank = async () => {
    if (!editBank) return;
    const e = editBank;
    if (!(await requireStepUp("Confirm changing where students pay"))) return;
    const res = await run("Saving payment details…", () => online(async (sb) => {
      const { error } = await sb.rpc("save_offline_payment_details", { p_bank_name: e.bank_name ?? "", p_account_name: e.account_name ?? "", p_account_number: e.account_number ?? "", p_instructions: e.instructions ?? "" });
      if (error) throw error;
      const back = await sb.rpc("offline_payment_details");
      if ((back.data as OfflineDetails | null)?.account_number !== (e.account_number ?? "").replace(/\s/g, "")) throw new Error("not_saved");
    }, { invalidates: ["payments"] }), { success: "Saved. Students see these details when they pay offline." });
    if (res.ok) { setEditBank(null); reload(); }
  };

  const pending = (rows ?? []).filter((r) => r.status === "pending"); const withReceipt = pending.filter((r) => r.receipt).length;
  return (
    <View style={{ gap: 16 }}>
      <View><Heading size={26} lh={32}>Offline payments</Heading><Text size={14} tone="muted">Students who chose to pay by cash or transfer. Leave a payment here until the money arrives: nothing changes for the student until you approve or decline it.</Text></View>

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text weight="medium">Where students pay</Text><Pressable accessibilityRole="button" onPress={() => setEditBank({ ...bank })} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="accent">Edit</Text></Pressable></View>
        {bank.bank_name || bank.account_number
          ? <Text size={14} tone="muted">{[bank.bank_name, bank.account_name].filter(Boolean).join(" · ")}{bank.account_number ? <Text size={14} weight="medium" num>{` · ${bank.account_number}`}</Text> : null}</Text>
          : <Text size={14} tone="warn">No bank account set. Students will be told to pay at their centre. Add one so they can transfer.</Text>}
      </Card>

      <Segmented value={tab} onChange={setTab} options={[{ value: "open", label: `To review${tab === "open" && rows ? ` (${pending.length})` : ""}` }, { value: "handled", label: "Handled" }]} />
      {tab === "open" && rows && pending.length > 0 && <Text size={14} tone="muted">{withReceipt} with a receipt · {pending.length - withReceipt} waiting for one. Newest receipts first.</Text>}
      <Err>{loadErr}</Err>

      {!rows ? <><Skeleton height={144} /><Skeleton height={144} /></> : rows.length === 0 ? <Empty icon={tab === "open" ? "checkCircle" : "inbox"} title={tab === "open" ? "Nothing to review" : "Nothing handled in the last 30 days"} hint={tab === "open" ? "New offline payments will show up here." : undefined} />
        : rows.map((r) => (
          <Card key={r.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <Avatar name={r.student_name} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}><Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>{r.student_name}</Text><Text weight="semibold" num>{naira(r.amount)}</Text></View>
                <Text size={14} tone="muted">{r.package}{r.courses.length ? ` · ${r.courses.join(" + ")}` : ""}</Text>
                <Text size={14} tone="muted">{place({ name: r.centre_name, city: r.centre_city })} · {r.instalment_number ? (r.instalments_total > 1 ? `Instalment ${r.instalment_number} of ${r.instalments_total}` : "Full payment") : "Payment"} · <Text size={14} tone="muted" num>{r.reference}</Text></Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {r.status === "pending" && (r.receipt ? <Badge tone="ok">Receipt uploaded {ago(r.receipt.uploaded_at)}</Badge> : <Badge tone="warn">No receipt yet · requested {ago(r.created_at)}</Badge>)}
              {r.status === "succeeded" && <Badge tone="ok">Approved {ago(r.updated_at)}</Badge>}
              {r.status === "failed" && <Badge tone="bad">Declined {ago(r.updated_at)}</Badge>}
              {r.status === "pending" && r.enrolment_status !== "pending_payment" && <Badge>Later instalment</Badge>}
              {r.student_phone ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${r.student_phone}`)} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="accent">{r.student_phone}</Text></Pressable> : null}
            </View>
            {r.student_note ? <View style={{ borderRadius: radius.xl, backgroundColor: p.c.sunken, paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14}>“{r.student_note}”</Text></View> : null}
            {r.status === "failed" && r.failed_reason ? <Text size={14} tone="muted">Reason: {r.failed_reason}</Text> : null}
            {r.status === "pending" && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button variant="secondary" style={{ flex: 1, height: 44, paddingHorizontal: 8 }} disabled={!r.receipt} onPress={() => openReceipt(r)}>Receipt</Button>
                <Button variant="secondary" style={{ flex: 1, height: 44, paddingHorizontal: 8 }} onPress={() => setDecl({ row: r, reason: "", purge: r.enrolment_status === "pending_payment" })}>Decline</Button>
                <Button style={{ flex: 1, height: 44, paddingHorizontal: 8 }} onPress={() => approve(r)}>Approve</Button>
              </View>)}
            {r.status !== "pending" && r.receipt ? <Pressable accessibilityRole="button" onPress={() => openReceipt(r)} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="accent">View receipt</Text></Pressable> : null}
          </Card>))}

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${view.row.student_name} · ${naira(view.row.amount)}` : ""}>
        {view && <View style={{ gap: 12 }}>
          {view.loading ? <Skeleton height={240} />
            : !view.url ? <Text tone="muted">{"Couldn't load the receipt."}</Text>
            : view.row.receipt?.mime.startsWith("image/") ? <Pressable accessibilityRole="imagebutton" accessibilityLabel="Receipt. Tap to open full size" onPress={() => WebBrowser.openBrowserAsync(view.url!)}><Image source={{ uri: view.url }} contentFit="contain" style={{ width: "100%", height: 360, borderRadius: radius.xl, backgroundColor: p.c.sunken }} /></Pressable>
            : <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(view.url!)} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.xl, backgroundColor: p.c.sunken, paddingHorizontal: 16, paddingVertical: 16 }}><Icon name="file" size={18} color={p.c.accent} /><Text tone="accent" numberOfLines={1} style={{ flex: 1 }}>Open {view.row.receipt?.name}</Text></Pressable>}
          <Text size={14} tone="muted">Reference <Text size={14} weight="medium" num>{view.row.reference}</Text>. Check it against your bank alert or cash book before approving.</Text>
          {view.row.status === "pending" && <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => { const r = view.row; setView(null); setDecl({ row: r, reason: "", purge: r.enrolment_status === "pending_payment" }); }}>Decline</Button>
            <Button style={{ flex: 1 }} onPress={() => approve(view.row)}>Approve</Button></View>}
        </View>}
      </Sheet>

      <Sheet open={!!decl} onClose={() => setDecl(null)} title="Decline this payment">
        {decl && <View style={{ gap: 12 }}>
          <Text size={14} tone="muted">{decl.row.student_name} · {naira(decl.row.amount)} · {decl.row.reference}. {"They'll get a notification with your reason."}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{REASONS.map((x) => <Chip key={x} on={decl.reason === x} onPress={() => setDecl({ ...decl, reason: x })}>{x}</Chip>)}</View>
          <Field label="Reason (shown to the student)" value={decl.reason} maxLength={300} onChangeText={(v) => setDecl({ ...decl, reason: v })} placeholder="e.g. We haven't received the transfer" />
          {decl.row.enrolment_status === "pending_payment"
            ? <SwitchRow title="Also remove their registration" hint="Cancels the unpaid registration and deletes the receipt, so they can register again from scratch. Leave off to let them pay again." value={decl.purge} onChange={(v) => setDecl({ ...decl, purge: v })} />
            : <View style={{ borderRadius: radius.xl, backgroundColor: p.c.sunken, padding: 12 }}><Text size={14} tone="muted">This student is already enrolled, so only this payment request is declined.</Text></View>}
          <Button variant="danger" disabled={decl.reason.trim().length < 3} onPress={decline}>{decl.purge ? "Decline and remove registration" : "Decline payment"}</Button>
        </View>}
      </Sheet>

      <Sheet open={!!editBank} onClose={() => setEditBank(null)} title="Where students pay">
        {editBank && <View style={{ gap: 12 }}>
          <Field label="Bank" value={editBank.bank_name ?? ""} maxLength={80} onChangeText={(v) => setEditBank({ ...editBank, bank_name: v })} placeholder="e.g. GTBank" />
          <Field label="Account name" value={editBank.account_name ?? ""} maxLength={120} onChangeText={(v) => setEditBank({ ...editBank, account_name: v })} />
          <Field label="Account number" keyboardType="number-pad" value={editBank.account_number ?? ""} maxLength={24} onChangeText={(v) => setEditBank({ ...editBank, account_number: v.replace(/[^\d ]/g, "") })} />
          <Area label="Instructions for students" value={editBank.instructions ?? ""} maxLength={600} onChangeText={(v) => setEditBank({ ...editBank, instructions: v })} rows={3} />
          <Button onPress={saveBank}>Save</Button>
        </View>}
      </Sheet>
    </View>
  );
}
