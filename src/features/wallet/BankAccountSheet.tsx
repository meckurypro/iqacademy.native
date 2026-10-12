// Port of web components/BankAccountSheet.tsx. An instructor or centre director saves THEIR OWN payout account: choose the bank (live list from Paystack),
// type the 10 digits, and the account name appears to check. Online-only: it talks to Paystack through the paystack-create-recipient function.
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { UserMessage } from "@/core/errors";
import { callAdminFunction } from "@/features/admin-money/adminFn";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Button, Err, Field, SearchField, SelectSheet, Sheet, Text } from "@/ui";

export type BankTarget = { kind: "instructor" } | { kind: "centre"; centreId: string; label?: string };
type Bank = { name: string; code: string };
let bankCache: Bank[] | null = null; // the list rarely changes: fetch once per app run

const MESSAGE: Record<string, string> = {
  payouts_not_configured: "Bank setup isn't switched on yet. You'll be able to add your account once payments are configured.",
  could_not_resolve_account: "Couldn't find that account. Check the bank and number.",
};
const say = (e: unknown) => (e instanceof UserMessage ? e.message : MESSAGE[(e as Error)?.message] ?? "Something went wrong. Please try again.");

export default function BankAccountSheet({ open, onClose, target, onSaved }: { open: boolean; onClose: () => void; target: BankTarget; onSaved: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={target.kind === "centre" && target.label ? `Bank account · ${target.label}` : "Payout bank account"}>
      {open ? <Form onClose={onClose} target={target} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

// Mounted only while the sheet is open, so every opening starts clean.
function Form({ onClose, target, onSaved }: { onClose: () => void; target: BankTarget; onSaved: () => void }) {
  const { p } = useTheme();
  const [banks, setBanks] = useState<Bank[]>(bankCache ?? []); const [q, setQ] = useState("");
  const [code, setCode] = useState(""); const [num, setNum] = useState("");
  const [resolved, setResolved] = useState<{ key: string; name?: string; err?: string }>({ key: "" });
  const [saving, setSaving] = useState(false); const [saveErr, setSaveErr] = useState(""); const [listErr, setListErr] = useState(""); const [warn, setWarn] = useState("");

  useEffect(() => {
    if (bankCache) return;
    callAdminFunction<{ banks: Bank[] }>("paystack-create-recipient", { action: "list_banks" }).then((r) => { bankCache = r.banks; setBanks(r.banks); }).catch((e) => setListErr(say(e)));
  }, []);

  // The account name shows up as soon as a bank is chosen and 10 digits are typed.
  const key = code && num.length === 10 ? `${code}:${num}` : "";
  useEffect(() => {
    if (!key) return;
    let live = true;
    callAdminFunction<{ account_name?: string }>("paystack-create-recipient", { action: "resolve", bank_code: code, account_number: num })
      .then((r) => { if (live) setResolved(r.account_name ? { key, name: r.account_name } : { key, err: MESSAGE.could_not_resolve_account }); })
      .catch((e) => { if (live) setResolved({ key, err: say(e) }); });
    return () => { live = false; };
  }, [key, code, num]);
  const here = resolved.key === key && key !== "";
  const name = here ? resolved.name ?? "" : ""; const checking = !!key && !here;
  const err = saveErr || listErr || (here ? resolved.err ?? "" : "");

  const options = useMemo(() => banks.filter((b) => !q.trim() || b.name.toLowerCase().includes(q.trim().toLowerCase())).map((b) => ({ value: b.code, label: b.name })), [banks, q]);
  const save = async () => {
    setSaving(true); setSaveErr("");
    try {
      const r = await callAdminFunction<{ name_match?: boolean }>("paystack-create-recipient",
        { action: "save", bank_code: code, account_number: num, ...(target.kind === "instructor" ? { target: "instructor" } : { centre_id: target.centreId }) }, ["wallet", "income"]);
      setSaving(false);
      if (r.name_match === false) { setWarn("This account name doesn't match your profile name. It's saved, but an admin will check it before paying."); setTimeout(() => { onSaved(); onClose(); }, 2600); return; }
      onSaved(); onClose();
    } catch (e) { setSaving(false); setSaveErr(say(e)); }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text size={14} tone="muted">Payouts go to this account. Choose the bank, type the account number, and check the name that appears is yours.</Text>
      <SearchField label="Search for your bank" value={q} onChangeText={setQ} />
      <SelectSheet label="Bank" value={code || null} options={options} onChange={setCode} placeholder={banks.length ? "Choose bank…" : "Loading banks…"} />
      <Field label="Account number" keyboardType="number-pad" maxLength={10} value={num} onChangeText={(t) => setNum(t.replace(/\D/g, ""))} />
      {checking || saving ? <Text size={14} tone="muted">{saving ? "Saving…" : "Checking account…"}</Text> : null}
      {name ? <View style={{ borderRadius: radius.xl, backgroundColor: p.a("ok", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="ok">{name}</Text></View> : null}
      {warn ? <View style={{ borderRadius: radius.xl, backgroundColor: p.a("warn", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="warn">{warn}</Text></View> : null}
      <Err>{err}</Err>
      <Button disabled={!name || checking || saving || !!warn} onPress={save}>Save account</Button>
    </View>
  );
}
