// Port of web pages/OfflinePay.tsx @d14323f: what to pay, where, the reference to quote, and a place to send the receipt. An admin confirms it once the money has arrived.
// The receipt goes through the upload queue: online it is sent at once; offline it waits (and survives the app being closed) and shows on the Pending screen.
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/core/auth";
import { friendly } from "@/core/errors";
import { mutateRpc, online, queueUpload, receiptJob, useRpc } from "@/data";
import { Screen } from "@/shell/Screen";
import { naira } from "@/shared/format";
import type { MyOffline, OfflineDetails } from "@/shared/offline";
import { fmtWhen, now } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Button, Card, Err, Heading, Icon, Sheet, Skeleton, Text, useFeedback } from "@/ui";
import { payInstalment } from "./payFlow";
import { pickReceiptFile, pickReceiptPhoto, takeReceiptPhoto, type PickedReceipt } from "./receiptDevice";

const TAGS = ["payments", "enrolments"];
const Row = ({ k, v }: { k: string; v: string }) => <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text size={14} tone="muted">{k}</Text><Text size={14} weight="medium" align="right" style={{ flexShrink: 1 }}>{v}</Text></View>;

export default function OfflinePay() {
  const { p } = useTheme(); const router = useRouter(); const { session } = useAuth(); const { run, toast, confirm } = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mineQ = useRpc<MyOffline[]>("my_offline_payments", {}, { tags: TAGS, ttlMs: 10_000 });
  const bankQ = useRpc<OfflineDetails>("offline_payment_details", {}, { tags: ["catalogue", "payments"], ttlMs: 5 * 60_000 });
  const row = mineQ.data ? mineQ.data.find((x) => x.id === id) ?? null : undefined; // undefined = still loading
  const bank = bankQ.data ?? {};
  const [file, setFile] = useState<PickedReceipt | null>(null); const [note, setNote] = useState("");
  const [choose, setChoose] = useState(false); const [err, setErr] = useState("");
  const [waiting, setWaiting] = useState(false); // a receipt is saved on this phone and will send when there is a connection
  const [preview, setPreview] = useState<string | null>(null);

  const receiptPath = row?.receipt?.path;
  useEffect(() => {
    let live = true;
    if (!receiptPath) return;
    online(async (sb) => (await sb.storage.from("payment-receipts").createSignedUrl(receiptPath, 600)).data?.signedUrl ?? null).then((u) => { if (live) setPreview(u); }).catch(() => { if (live) setPreview(null); });
    return () => { live = false; };
  }, [receiptPath]);

  const copy = async (text: string, what: string) => { try { await Clipboard.setStringAsync(text); toast(`${what} copied`, "ok"); } catch { toast("Couldn't copy. Select the text and copy it.", "bad"); } };
  const pick = async (how: "library" | "camera" | "file") => {
    setChoose(false); setErr("");
    try { const f = await (how === "library" ? pickReceiptPhoto() : how === "camera" ? takeReceiptPhoto() : pickReceiptFile()); if (f) setFile(f); } catch (e) { setErr(friendly(e)); }
  };

  const send = async () => {
    if (!file || !row || !session) return; setErr("");
    const r = await run("Sending your receipt…", async () => queueUpload(receiptJob({ studentId: session.user.id, paymentId: row.id, mime: file.mime, size: file.size, name: file.name, note, now: now() }), file.uri, { tags: TAGS }), { quiet: true });
    if (!r.ok) return setErr(r.message);
    setFile(null); setNote("");
    if (r.data.status === "queued") { setWaiting(true); toast("Saved. It will be sent when you're back online.", "ok"); } else { setWaiting(false); toast("Receipt sent. We'll confirm your payment soon.", "ok"); mineQ.refetch(); }
  };

  const payOnlineInstead = async () => {
    if (!row?.instalment_id) return;
    const yes = await confirm({ title: "Pay online instead?", message: "This offline request will be cancelled and you'll go to secure online payment.", confirmLabel: "Pay online" });
    if (!yes) return; setErr("");
    const r = await run("Opening secure payment…", async () => {
      await mutateRpc("cancel_offline_request", { p_payment_id: row.id }, { invalidates: TAGS });
      return payInstalment(row.instalment_id!);
    }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    if (r.data === "succeeded") { toast("Payment received. Your classes are booked.", "ok"); router.replace("/"); }
    else if (r.data === "pending") { toast("Still confirming. We'll update your account when it lands.", "ok"); router.replace("/"); }
    else setErr("Payment not completed. No money was taken. You can try again from Home.");
  };

  const cancel = async () => {
    if (!row) return;
    const whole = row.enrolment_status === "pending_payment";
    const yes = await confirm({
      title: whole ? "Cancel this registration?" : "Cancel this payment request?",
      message: whole ? "Your registration will be cancelled so you can start again. If you've already paid, don't cancel: wait for us to confirm." : "You can start another payment from your home screen.",
      confirmLabel: whole ? "Cancel registration" : "Cancel request", cancelLabel: "Keep it", danger: true });
    if (!yes) return;
    const r = await run("Cancelling…", () => whole
      ? mutateRpc("cancel_enrolment", { p_enrolment_id: row.enrolment_id, p_reason: "Cancelled by student (offline payment)" }, { invalidates: TAGS })
      : mutateRpc("cancel_offline_request", { p_payment_id: row.id }, { invalidates: TAGS }), { success: whole ? "Registration cancelled." : "Request cancelled." });
    if (r.ok) router.replace("/");
  };

  if (row === undefined) return <Screen><View style={{ gap: 16 }}><Skeleton height={32} style={{ width: "50%" }} /><Skeleton height={128} /><Skeleton height={160} /></View></Screen>;
  if (row === null) return (
    <Screen>
      <Card style={{ alignItems: "center", gap: 12, padding: 24, marginTop: 24 }}>
        <Heading size={26} lh={32} align="center">Nothing waiting here</Heading>
        <Text tone="muted" align="center">This payment has been confirmed, declined or cancelled. Your home screen has the latest.</Text>
        <Button style={{ width: "100%" }} onPress={() => router.replace("/")}>Go home</Button>
      </Card>
    </Screen>);

  const has = bank.bank_name || bank.account_name || bank.account_number;
  const sent = !!row.receipt;
  const copyBox = (label: string, value: string, what: string, big = true) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`Copy ${what}`} onPress={() => copy(value, what)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 12, backgroundColor: p.c.sunken, paddingHorizontal: 16, paddingVertical: 12, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      <View style={{ flex: 1 }}><Text size={12} tone="muted">{label}</Text><Text size={big ? 18 : 17} weight="semibold" num selectable style={{ letterSpacing: 0.5 }}>{value}</Text></View>
      <Text size={14} tone="accent">Copy</Text>
    </Pressable>);

  return (
    <Screen onRefresh={() => { mineQ.refetch(); bankQ.refetch(); }}>
      <View style={{ gap: 20 }}>
        <View><Text size={14} tone="muted">Offline payment</Text><Heading size={26} lh={32}>{sent ? "Receipt sent" : "Pay and send your receipt"}</Heading></View>

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View><Text size={14} tone="muted">Amount to pay</Text><Text size={30} weight="semibold" lh={36} num>{naira(row.amount)}</Text></View>
            <Badge tone={sent ? "ok" : "warn"}>{sent ? "Awaiting confirmation" : "Waiting for your payment"}</Badge>
          </View>
          <Text size={14} tone="muted">{row.package}{row.courses.length ? ` · ${row.courses.join(" + ")}` : ""}{row.instalment_label ? ` · ${row.instalment_label}` : ""}</Text>
          {copyBox("Your reference. Use it as the transfer narration.", row.reference, "Reference")}
        </Card>

        <Card style={{ gap: 12 }}>
          <Text weight="medium">Where to pay</Text>
          {has ? (
            <View style={{ gap: 8 }}>
              {bank.bank_name ? <Row k="Bank" v={bank.bank_name} /> : null}
              {bank.account_name ? <Row k="Account name" v={bank.account_name} /> : null}
              {bank.account_number ? copyBox("Account number", bank.account_number, "Account number") : null}
            </View>) : <Text size={14} tone="muted">{"Pay at your centre's front desk, or ask the team for transfer details."}</Text>}
          {bank.instructions ? <Text size={14} tone="muted">{bank.instructions}</Text> : null}
        </Card>

        <Card style={{ gap: 12 }}>
          <Text weight="medium">{sent ? "Your receipt" : "Send your receipt"}</Text>
          {sent && row.receipt ? (
            <View style={{ gap: 8 }}>
              {preview && row.receipt.mime.startsWith("image/")
                ? <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open your receipt" onPress={() => WebBrowser.openBrowserAsync(preview)}><Image source={{ uri: preview }} contentFit="contain" style={{ height: 256, width: "100%", borderRadius: 12, backgroundColor: p.c.sunken }} accessibilityIgnoresInvertColors /></Pressable>
                : preview ? <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(preview)} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: p.c.sunken, paddingHorizontal: 16, paddingVertical: 12 }}><Icon name="file" size={18} color={p.c.accent} /><Text size={14} tone="accent" numberOfLines={1} style={{ flex: 1 }}>{row.receipt.name}</Text></Pressable> : null}
              <Text size={14} tone="muted">Sent {fmtWhen(row.receipt.uploaded_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. {"We'll notify you when it's confirmed."}</Text>
              {row.student_note ? <View style={{ borderRadius: 12, backgroundColor: p.c.sunken, paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14}>{row.student_note}</Text></View> : null}
            </View>) : null}
          {waiting && !sent ? <View style={{ borderRadius: 12, backgroundColor: p.a("warn", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="warn">Your receipt is saved on this phone and will be sent when you are back online. You can check it on the Pending screen.</Text></View> : null}
          {file ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 12, backgroundColor: p.c.sunken, paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}><Icon name={file.mime === "application/pdf" ? "file" : "image"} size={18} color={p.c.muted} /><Text size={14} numberOfLines={1} style={{ flex: 1 }}>{file.name}</Text></View>
                <Text size={14} tone="muted" onPress={() => setFile(null)} accessibilityRole="button">Remove</Text>
              </View>
              <View>
                <Text size={14} tone="muted" style={{ marginBottom: 6 }}>Note for the team (optional)</Text>
                <TextInput value={note} onChangeText={setNote} maxLength={500} multiline placeholder="e.g. Paid from GTB at 2pm, in the name of Ada" placeholderTextColor={p.a("muted", 0.6)} accessibilityLabel="Note for the team"
                  style={{ minHeight: 72, borderRadius: 12, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, paddingHorizontal: 16, paddingVertical: 12, fontFamily: "Geist-Regular", fontSize: 15, color: p.c.ink, textAlignVertical: "top" }} />
              </View>
              <Button onPress={send}>{sent ? "Replace receipt" : "Send receipt"}</Button>
            </View>
          ) : <Button variant={sent ? "secondary" : "primary"} onPress={() => setChoose(true)}>{sent ? "Replace receipt" : "Choose photo or PDF"}</Button>}
          <Err>{err}</Err>
          {!sent ? <Text size={14} tone="muted">Paying cash? Give it to your centre’s coordinator or director: they record it and your classes unlock at once, with no receipt needed.</Text> : null}
        </Card>

        <Card style={{ gap: 4 }}>
          <Text size={14} weight="medium">What happens next</Text>
          <Text size={14} tone="muted">1. You pay the exact amount. 2. The team confirms it when the money arrives. 3. You get a notification and your classes unlock.</Text>
        </Card>

        <View style={{ gap: 8 }}>
          {row.instalment_id ? <Button variant="secondary" onPress={payOnlineInstead}>Pay online instead</Button> : null}
          <Button variant="ghost" onPress={cancel}>{row.enrolment_status === "pending_payment" ? "Cancel registration" : "Cancel this request"}</Button>
        </View>
      </View>

      <Sheet open={choose} onClose={() => setChoose(false)} title="Add your receipt">
        <View style={{ gap: 8 }}>
          <Button variant="secondary" icon="image" onPress={() => pick("library")}>Choose a photo</Button>
          <Button variant="secondary" icon="scan" onPress={() => pick("camera")}>Take a photo</Button>
          <Button variant="secondary" icon="file" onPress={() => pick("file")}>Choose a PDF</Button>
          <Text size={12} tone="muted" align="center" style={{ paddingTop: 4 }}>Photos are shrunk before sending. PDFs can be up to 5 MB.</Text>
        </View>
      </Sheet>
    </Screen>
  );
}
