// Port of web pages/Centres.tsx. Locations, revenue share, payout bank account, team link. Every save is online-only (the server checks codes, shares and bank names).
// "Use my current location" asks for foreground location only, at the moment it is tapped, and says what to do if it is refused.
import { useState } from "react";
import { Linking, View } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { friendly, mapDuplicate, ok, touched } from "@/core/errors";
import { invokeFunction, mutate, online, useQuery } from "@/data";
import { place, placeSub } from "@/shared/web/centre";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Button, Card, Empty, Err, Field, Heading, Icon, SelectSheet, Sheet, Skeleton, SwitchRow, Text, useFeedback } from "@/ui";
import { useBanks } from "./useBanks";

 
type Form = { id: string; name: string; code: string; address: string; city: string; state: string; capacity: string; share: string; contact: string; phone: string; lat: string; lng: string; active: boolean };
const empty: Form = { id: "", name: "", code: "", address: "", city: "Lagos", state: "Lagos", capacity: "", share: "0", contact: "", phone: "", lat: "", lng: "", active: true };
const digits = (s: string) => s.replace(/\D/g, "");

export default function Centres() {
  const { p } = useTheme(); const router = useRouter(); const { run, confirm, toast } = useFeedback();
  const [f, setF] = useState<Form | null>(null); const [bank, setBank] = useState<any>(null);
  const [acct, setAcct] = useState({ code: "", number: "" }); const [accName, setAccName] = useState(""); const [err, setErr] = useState("");
  const q = useQuery<any[]>({
    key: ["adminCentres"], tags: ["centres"], ttlMs: 30_000,
    fn: async (sb) => (ok(await sb.from("centres").select("id,name,code,address,city,state,latitude,longitude,contact_name,contact_phone,default_capacity,is_active,centre_terms(revenue_share_pct),centre_payout_accounts(bank_name,account_last4,account_name)").order("name")) as any[]) ?? [],
  });
  const rows = q.data ?? (q.error ? [] : undefined); const loadErr = q.error ? friendly(q.error) : "";
  const banks = useBanks(!!bank).data ?? [];
  const reload = () => q.refetch();
  const set = (patch: Partial<Form>) => setF((cur) => (cur ? { ...cur, ...patch } : cur));

  const save = async () => {
    if (!f) return; setErr("");
    const body = { name: f.name.trim(), code: f.code.trim().toUpperCase(), address: f.address || null, city: f.city || null, state: f.state || null, contact_name: f.contact || null, contact_phone: f.phone || null, latitude: f.lat ? Number(f.lat) : null, longitude: f.lng ? Number(f.lng) : null, default_capacity: f.capacity ? Number(f.capacity) : null, is_active: f.active };
    const share = Number(f.share || 0);
    if (!(share >= 0 && share <= 100)) return setErr("The centre's share must be between 0 and 100%.");
    const r = await run(f.id ? "Saving centre…" : "Creating centre…", () => online(async (sb) => {
      let id = f.id;
      try {
        if (id) touched(await sb.from("centres").update(body).eq("id", id).select("id"));
        else id = (ok(await sb.from("centres").insert(body).select("id").single()) as { id: string }).id;
      } catch (e) { throw mapDuplicate(e, "centre_code_taken"); }
      // The revenue share lives in its own table. Update it, or create the row if the centre has none yet, and make sure it stuck.
      const up = await sb.from("centre_terms").update({ revenue_share_pct: share }).eq("centre_id", id).select("centre_id");
      if (up.error) throw up.error;
      if (!up.data?.length) { const ins = await sb.from("centre_terms").insert({ centre_id: id, revenue_share_pct: share }); if (ins.error) throw mapDuplicate(ins.error, "not_saved"); }
      await reload();
    }, { invalidates: ["centres"] }), { success: f.id ? "Centre saved" : "Centre created", quiet: true });
    if (!r.ok) return setErr(r.message);
    setF(null);
  };
  const remove = async () => {
    if (!f?.id) return;
    if (!(await confirm({ title: `Delete ${f.name || "this centre"}?`, message: "This permanently deletes the centre with its class days, course runs, team roles and payout account. It can't be deleted once it has students enrolled, payments or attendance on record. Hide it instead (turn off “Open for students”).", confirmLabel: "Delete centre", danger: true }))) return;
    setErr("");
    const r = await run("Deleting centre…", async () => { await mutate.rpc("delete_centre", { p_centre_id: f.id }, { invalidates: ["centres"] }); await reload(); }, { success: "Centre deleted", quiet: true });
    if (!r.ok) return setErr(r.message);
    setF(null);
  };

  const useLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { toast(perm.canAskAgain ? "Location was not allowed. Type the coordinates instead, or try again." : "Location is turned off for IQ Academy. Turn it on in your phone's settings, then try again.", "bad"); if (!perm.canAskAgain) void Linking.openSettings(); return; }
      const g = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      set({ lat: g.coords.latitude.toFixed(6), lng: g.coords.longitude.toFixed(6) });
    } catch { toast("Couldn't get your location. Make sure location is on and try again.", "bad"); }
  };

  const openBank = (c: any) => { setBank(c); setErr(""); setAccName(""); setAcct({ code: "", number: "" }); };
  const resolve = async () => {
    setErr("");
    const r = await run("Verifying account…", () => invokeFunction<{ account_name?: string }>("paystack-create-recipient", { action: "resolve", bank_code: acct.code, account_number: acct.number }), { quiet: true });
    if (!r.ok) return setErr(r.message);
    if (r.data.account_name) setAccName(r.data.account_name); else setErr("Couldn't find that account. Check the bank and number.");
  };
  const saveBank = async () => {
    setErr("");
    const r = await run("Saving payout account…", async () => {
      const out = await invokeFunction<{ ok?: boolean }>("paystack-create-recipient", { action: "save", centre_id: bank.id, bank_code: acct.code, account_number: acct.number }, { invalidates: ["centres"] });
      if (!out.ok) throw new Error("not_saved");
      await reload();
    }, { success: "Payout account saved", quiet: true });
    if (!r.ok) return setErr("Couldn't save the account.");
    setBank(null);
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Heading size={26} lh={32}>Centres</Heading><Button style={{ height: 40 }} onPress={() => { setErr(""); setF(empty); }}>+ New</Button></View>
      {loadErr ? <View style={{ gap: 8 }}><Err>{loadErr}</Err><Button variant="secondary" onPress={reload}>Try again</Button></View> : null}
      {!rows ? <Skeleton height={96} /> : rows.length === 0 && !loadErr ? <Empty title="No centres yet. Tap “+ New” to add one." /> : rows.map((c) => {
        const t = c.centre_terms?.revenue_share_pct ?? c.centre_terms?.[0]?.revenue_share_pct; const a = c.centre_payout_accounts?.account_last4 ? c.centre_payout_accounts : c.centre_payout_accounts?.[0];
        return (
          <Card key={c.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{place(c)}</Text>{placeSub(c) ? <Text size={14} tone="muted">{placeSub(c)}</Text> : null}</View>
              <View style={{ alignItems: "flex-end", gap: 4 }}><Badge tone="ok">{t ?? 0}% share</Badge>{!c.is_active && <Badge>Hidden</Badge>}</View>
            </View>
            <Text size={14} tone="muted">{a?.account_last4 ? `Payout: ${a.bank_name} ••${a.account_last4} (${a.account_name})` : "No payout account yet"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button variant="secondary" style={{ height: 40, flex: 1, paddingHorizontal: 8 }} onPress={() => { setErr(""); setF({ id: c.id, name: c.name, code: c.code, address: c.address ?? "", city: c.city ?? "", state: c.state ?? "", capacity: c.default_capacity != null ? String(c.default_capacity) : "", share: String(t ?? 0), contact: c.contact_name ?? "", phone: c.contact_phone ?? "", lat: c.latitude != null ? String(c.latitude) : "", lng: c.longitude != null ? String(c.longitude) : "", active: c.is_active !== false }); }}>Edit</Button>
              <Button variant="secondary" style={{ height: 40, flex: 1.4, paddingHorizontal: 8 }} onPress={() => openBank(c)}>Bank account</Button>
              <Button variant="secondary" style={{ height: 40, flex: 1, paddingHorizontal: 8 }} onPress={() => router.push(`/team/${c.id}`)}>Team</Button>
            </View>
          </Card>); })}

      <Sheet open={!!f} onClose={() => setF(null)} title={f?.id ? "Edit centre" : "New centre"}>
        {f && <View style={{ gap: 12 }}>
          <Field label="Name" value={f.name} onChangeText={(v) => set({ name: v })} />
          <Field label="Short code" value={f.code} onChangeText={(v) => set({ code: v })} placeholder="e.g. YABA" autoCapitalize="characters" />
          <Field label="Address" value={f.address} onChangeText={(v) => set({ address: v })} />
          <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Field label="City" value={f.city} onChangeText={(v) => set({ city: v })} /></View><View style={{ flex: 1 }}><Field label="State" value={f.state} onChangeText={(v) => set({ state: v })} /></View></View>
          <Field label="Contact person" value={f.contact} onChangeText={(v) => set({ contact: v })} />
          <Field label="Contact phone" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => set({ phone: v })} />
          <Button variant="secondary" style={{ height: 44 }} onPress={useLocation}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="pin" size={16} color={p.c.ink} /><Text size={14} weight="medium">{f.lat ? `${f.lat}, ${f.lng}` : "Use my current location (when at the centre)"}</Text></View></Button>
          <Field label="Capacity" keyboardType="number-pad" value={f.capacity} onChangeText={(v) => set({ capacity: digits(v) })} />
          <Field label="Centre's share of tuition (%)" keyboardType="decimal-pad" value={f.share} onChangeText={(v) => set({ share: v.replace(/[^\d.]/g, "") })} />
          <SwitchRow title="Open for students" hint="Turn off to hide this centre from enrolment without deleting it." value={f.active} onChange={(v) => set({ active: v })} />
          <Err>{err}</Err><Button disabled={!f.name || !f.code} onPress={save}>Save</Button>
          {f.id && <Button variant="ghost" onPress={remove}><Text size={15} weight="medium" tone="bad">Delete this centre…</Text></Button>}
        </View>}
      </Sheet>
      <Sheet open={!!bank} onClose={() => setBank(null)} title={`Bank account · ${bank?.name ?? ""}`}>
        <View style={{ gap: 12 }}>
          <SelectSheet label="Bank" value={acct.code} placeholder={banks.length ? "Choose bank…" : "Loading banks…"} options={banks.map((b) => ({ value: b.code, label: b.name }))} onChange={(v) => { setAcct({ ...acct, code: v }); setAccName(""); }} />
          <Field label="Account number" keyboardType="number-pad" maxLength={10} value={acct.number} onChangeText={(v) => { setAcct({ ...acct, number: digits(v) }); setAccName(""); }} />
          {accName ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: p.a("ok", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Icon name="check" size={16} color={p.c.ok} /><Text size={14} tone="ok" style={{ flex: 1 }}>{accName}</Text></View> : null}
          <Err>{err}</Err>
          {!accName ? <Button disabled={!acct.code || acct.number.length !== 10} onPress={resolve}>Verify account</Button> : <Button onPress={saveBank}>Save payout account</Button>}
        </View>
      </Sheet>
    </View>
  );
}
