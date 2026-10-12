// Small pieces the cash screens share: the list of cash to send, the receipt chooser and the academy bank details. Port of web components/CashParts.tsx @feaca5e.
import { Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { friendly, naira } from "@/core/errors";
import { pickReceiptFile, pickReceiptPhoto, takeReceiptPhoto, type PickedReceipt } from "@/features/enrol/receiptDevice";
import type { OfflineDetails } from "@/shared/offline";
import { fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Area, Button, Card, Icon, Text, useFeedback } from "@/ui";
import { flipPick, pickedTotal } from "./cash";

export type Pickable = { id: string; title: string; sub: string; amount: number; when: string };

/** Tick the cash that goes in this transfer or hand-over. Everything is ticked to begin with. */
export function PickItems({ items, picked, onChange }: { items: Pickable[]; picked: ReadonlySet<string>; onChange: (s: Set<string>) => void }) {
  const { p } = useTheme();
  const all = picked.size === items.length;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable accessibilityRole="button" onPress={() => onChange(all ? new Set() : new Set(items.map((i) => i.id)))} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="accent">{all ? "Untick all" : "Tick all"}</Text></Pressable>
        <Text size={14} tone="muted">{picked.size} of {items.length} · <Text size={14} weight="semibold" num>{naira(pickedTotal(items, picked))}</Text></Text>
      </View>
      <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: p.c.line, overflow: "hidden" }}>
        {items.map((i, n) => {
          const on = picked.has(i.id);
          return (
            <Pressable key={i.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${i.title}, ${naira(i.amount)}`} onPress={() => onChange(flipPick(picked, i.id))}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, minHeight: 56, borderTopWidth: n ? 1 : 0, borderTopColor: p.c.line }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? p.c.accent : p.c.line, backgroundColor: on ? p.c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                {on ? <Icon name="check" size={14} color={p.c.accentInk} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={14} weight="medium" numberOfLines={1}>{i.title}</Text>
                <Text size={12} tone="muted" numberOfLines={1}>{i.sub} · {fmtWhen(i.when, { day: "numeric", month: "short" })}</Text>
              </View>
              <Text size={14} weight="semibold" num>{naira(i.amount)}</Text>
            </Pressable>);
        })}
      </View>
    </View>
  );
}

/** Photo or PDF of the bank receipt, plus an optional note. */
export function ReceiptField({ file, setFile, note, setNote, onError }: { file: PickedReceipt | null; setFile: (f: PickedReceipt | null) => void; note: string; setNote: (s: string) => void; onError: (m: string) => void }) {
  const { p } = useTheme();
  const pick = (fn: () => Promise<PickedReceipt | null>) => async () => { try { const f = await fn(); if (f) { setFile(f); onError(""); } } catch (e) { onError(friendly(e)); } };
  return (
    <View style={{ gap: 12 }}>
      {file ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: radius.xl, backgroundColor: p.c.sunken, paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}><Icon name={file.mime === "application/pdf" ? "file" : "image"} size={18} color={p.c.muted} /><Text size={14} numberOfLines={1} style={{ flex: 1 }}>{file.name}</Text></View>
          <Pressable accessibilityRole="button" onPress={() => setFile(null)} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="muted">Remove</Text></Pressable>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Button variant="secondary" onPress={pick(takeReceiptPhoto)}>Take a photo of the receipt</Button>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={pick(pickReceiptPhoto)}>From photos</Button>
            <Button variant="secondary" style={{ flex: 1 }} onPress={pick(pickReceiptFile)}>PDF or file</Button>
          </View>
        </View>)}
      <Area label="Note for the team (optional)" value={note} onChangeText={setNote} maxLength={500} rows={2} placeholder="e.g. Sent from GTB at 2pm" />
    </View>
  );
}

const KV = ({ k, v }: { k: string; v: string }) => <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text size={14} tone="muted">{k}</Text><Text size={14} weight="medium" align="right" style={{ flex: 1 }}>{v}</Text></View>;

/** The academy account the money goes to (the same details students see for transfers). */
export function BankCard({ bank, title = "Send it to this account" }: { bank: OfflineDetails; title?: string }) {
  const { toast } = useFeedback();
  if (!bank.account_number && !bank.bank_name) return <Card><Text size={14} tone="warn">No academy bank account is set up yet. Ask an admin to add it on the Offline payments page.</Text></Card>;
  const copy = async () => { try { await Clipboard.setStringAsync(bank.account_number ?? ""); toast("Account number copied", "ok"); } catch { toast("Couldn't copy. Select the number and copy it.", "bad"); } };
  return (
    <Card style={{ gap: 8 }}>
      <Text weight="medium">{title}</Text>
      {bank.bank_name ? <KV k="Bank" v={bank.bank_name} /> : null}
      {bank.account_name ? <KV k="Account name" v={bank.account_name} /> : null}
      {bank.account_number ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Copy account number ${bank.account_number}`} onPress={copy} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: radius.xl, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "transparent" }}>
          <View><Text size={12} tone="muted">Account number</Text><Text size={18} weight="semibold" num>{bank.account_number}</Text></View><Text size={14} tone="accent">Copy</Text>
        </Pressable>) : null}
    </Card>
  );
}
