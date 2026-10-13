// Port of web pages/Prices.tsx. Admin: package prices, how many instalments are allowed, and what each instalment costs. Changes apply to new enrolments only.
// Everything is saved in one call (save_package) so a package is never left with half a plan. Online-only. The rules live in pricing.ts (the database enforces the same ones).
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/core/auth";
import { friendly, naira, ok } from "@/core/errors";
import { mutate, useQuery } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Badge, Button, Card, Empty, Err, Field, Heading, Icon, SelectSheet, Sheet, Skeleton, SwitchRow, Text, useFeedback } from "@/ui";
import SoloPrices from "./SoloPrices";
import { MAX_INST, blankPackage, chargedAmounts, defaultRows, digits, nextRule, packageProblems, partsFromCharged, ruleText, split, toKobo, type InstRow, type PackageForm } from "./pricing";

 
export default function Prices() {
  const { p } = useTheme(); const { roles } = useAuth(); const { run, confirm } = useFeedback();
  const isAdmin = roles.some((r) => r.role === "admin" || r.role === "super_admin");
  const [f, setF] = useState<PackageForm | null>(null); const [show, setShow] = useState(false); const [err, setErr] = useState("");
  const q = useQuery<any[]>({
    key: ["packages"], tags: ["packages", "courses"], ttlMs: 30_000,
    fn: async (sb) => (ok(await sb.from("packages").select("id,code,name,description,course_count,duration_weeks,price_full,instalment_fee,is_active,sort_order,package_instalments(number,label,amount,due_rule)").neq("code", "SOLO").order("sort_order")) as any[]) ?? [],
  });
  const cq = useQuery<number>({ key: ["activeCourseCount"], tags: ["courses"], ttlMs: 5 * 60_000, fn: async (sb) => (await sb.from("courses").select("id", { count: "exact", head: true }).eq("is_active", true)).count ?? 10 });
  const rows = q.data ?? (q.error ? [] : undefined); const loadErr = q.error ? friendly(q.error) : ""; const courseMax = cq.data || 10;
  if (!isAdmin) return <Redirect href="/" />;

  const set = (patch: Partial<PackageForm>) => setF((cur) => (cur ? { ...cur, ...patch } : cur));
  const setRow = (i: number, patch: Partial<InstRow>) => setF((cur) => (cur ? { ...cur, inst: cur.inst.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : cur));
  const open = (next: PackageForm) => { setErr(""); setShow(false); setF(next); };
  const edit = (pk: any) => {
    const inst = [...(pk.package_instalments ?? [])].sort((a: any, b: any) => a.number - b.number);
    open({ id: pk.id, code: pk.code, name: pk.name, description: pk.description ?? "", courses: String(pk.course_count), weeks: pk.duration_weeks ? String(pk.duration_weeks) : "", price: String(pk.price_full / 100), fee: pk.instalment_fee ? String(pk.instalment_fee / 100) : "", active: pk.is_active, instOn: inst.length > 0,
      inst: partsFromCharged(inst.map((i: any) => i.amount), pk.instalment_fee ?? 0).map((amount, k) => ({ label: inst[k].label, amount, rule: inst[k].due_rule })) });
  };

  const courseN = f ? Number(f.courses) : 0; const priceN = f ? Number(f.price) : 0;
  const instTotal = f ? f.inst.reduce((s, r) => s + (Number(r.amount) || 0), 0) : 0; const diff = instTotal - priceN;
  const problems = f ? packageProblems(f, courseMax) : [];
  const toggleInst = (on: boolean) => { if (f) set({ instOn: on, fee: on ? f.fee : "", inst: on && f.inst.length === 0 ? defaultRows(f.price, courseN || 2) : f.inst }); };
  const addRow = () => { if (f && f.inst.length < MAX_INST) set({ inst: [...f.inst, { label: `Instalment ${f.inst.length + 1}`, amount: "", rule: nextRule(f.inst, courseN) }] }); };
  const splitEvenly = () => { if (f && priceN > 0 && f.inst.length) { const a = split(priceN, f.inst.length); set({ inst: f.inst.map((r, i) => ({ ...r, amount: a[i] })) }); } };

  const save = async () => {
    if (!f) return;
    setShow(true); if (problems.length) return;
    setErr("");
    const r = await run(f.id ? "Saving package…" : "Creating package…", async () => {
      await mutate.rpc("save_package", {
        p_package_id: f.id || null, p_code: f.code.trim(), p_name: f.name.trim(), p_description: f.description.trim() || null, p_course_count: courseN, p_duration_weeks: f.weeks ? Number(f.weeks) : null,
        p_price_full: toKobo(f.price), p_is_active: f.active, p_instalments: f.instOn ? f.inst.map((r, i) => ({ label: r.label.trim(), amount: toKobo(r.amount), due_rule: i === 0 ? "before_start" : r.rule })) : [],
        p_instalment_fee: f.instOn ? toKobo(f.fee) : 0,
      }, { invalidates: ["packages"] });
      await q.refetch();
    }, { success: "Package saved. New enrolments will use these prices.", quiet: true });
    if (!r.ok) return setErr(r.message);
    setF(null);
  };
  const remove = async () => {
    if (!f?.id) return;
    if (!(await confirm({ title: `Delete ${f.name || "this package"}?`, message: "This permanently deletes the package and its instalment plan. A package that students have enrolled on can't be deleted. Take it off sale instead.", confirmLabel: "Delete package", danger: true }))) return;
    setErr("");
    const r = await run("Deleting package…", async () => { await mutate.rpc("delete_package", { p_package_id: f.id }, { invalidates: ["packages"] }); await q.refetch(); }, { success: "Package deleted", quiet: true });
    if (!r.ok) return setErr(r.message);
    setF(null);
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Heading size={26} lh={32}>Prices</Heading><Button style={{ height: 40 }} onPress={() => open(blankPackage)}>+ New</Button></View>
      <Card><Text size={14} tone="muted">Changes apply to new enrolments only. Students who have already enrolled keep the price and instalments they signed up for.</Text></Card>
      {loadErr ? <View style={{ gap: 8 }}><Err>{loadErr}</Err><Button variant="secondary" onPress={() => q.refetch()}>Try again</Button></View> : null}

      {!rows ? <Skeleton height={112} /> : rows.length === 0 && !loadErr ? <Empty title="No packages yet." /> : rows.map((pk) => {
        const inst = [...(pk.package_instalments ?? [])].sort((a: any, b: any) => a.number - b.number);
        const total = inst.reduce((s: number, i: any) => s + i.amount, 0);
        return (
          <Card key={pk.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{pk.name}</Text><Text size={14} tone="muted">{pk.course_count} course{pk.course_count === 1 ? "" : "s"}{pk.duration_weeks ? ` · ${pk.duration_weeks} weeks` : ""}</Text></View>
              <View style={{ alignItems: "flex-end", gap: 4 }}><Text size={18} weight="semibold" num>{naira(pk.price_full)}</Text><Badge tone={pk.is_active ? "ok" : "muted"}>{pk.is_active ? "On sale" : "Hidden"}</Badge></View>
            </View>
            {inst.length === 0 ? <Text size={14} tone="muted">Pay in full only</Text> : (
              <View style={{ gap: 4 }}>
                {inst.map((i: any, k: number) => <View key={i.number} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text size={14} tone="muted" numberOfLines={1} style={{ flex: 1 }}>{`${i.number}. ${i.label}${k === inst.length - 1 && pk.instalment_fee > 0 ? ` (includes ${naira(pk.instalment_fee)} extra fee)` : ""}`}</Text><Text size={14} num>{naira(i.amount)}</Text></View>)}
                <Text size={14} tone={total - (pk.instalment_fee ?? 0) === pk.price_full ? "muted" : "warn"}>{total - (pk.instalment_fee ?? 0) === pk.price_full ? `Students pay ${naira(total)} in instalments: ${naira(pk.price_full)} + ${naira(pk.instalment_fee ?? 0)} extra fee for IQ Academy.` : `Instalments (without the fee) total ${naira(total - (pk.instalment_fee ?? 0))}, not the full price. Edit and fix it.`}</Text>
              </View>)}
            <Button variant="secondary" style={{ height: 40 }} onPress={() => edit(pk)}>Edit</Button>
          </Card>);
      })}

      <View style={{ paddingTop: 16 }}><SoloPrices /></View>

      <Sheet open={!!f} onClose={() => setF(null)} title={f?.id ? "Edit package" : "New package"}>
        {f && <View style={{ gap: 12 }}>
          <Field label="Name" value={f.name} onChangeText={(v) => set({ name: v })} />
          {!f.id && <Field label="Short code (can't be changed later)" value={f.code} placeholder="e.g. STANDARD" autoCapitalize="characters" onChangeText={(v) => set({ code: v.toUpperCase() })} />}
          <Field label="Description (shown to students)" value={f.description} onChangeText={(v) => set({ description: v })} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><Field label="Courses in the pack" keyboardType="number-pad" value={f.courses} onChangeText={(v) => set({ courses: digits(v).slice(0, 2) })} /></View>
            <View style={{ flex: 1 }}><Field label="Weeks (optional)" keyboardType="number-pad" value={f.weeks} onChangeText={(v) => set({ weeks: digits(v).slice(0, 3) })} /></View>
          </View>
          <Field label="Full price (₦), if paid in one go" keyboardType="number-pad" value={f.price} onChangeText={(v) => set({ price: digits(v).slice(0, 9) })} />
          <SwitchRow title="On sale" hint="Students can choose this pack." value={f.active} onChange={(v) => set({ active: v })} />

          <View style={{ gap: 12, borderRadius: radius["2xl"], backgroundColor: p.a("sunken", 0.6), padding: 12 }}>
            <SwitchRow title="Let students pay in instalments" value={f.instOn} onChange={toggleInst} />
            {!f.instOn ? <Text size={14} tone="muted">Students will only see “pay in full”{priceN > 0 ? ` (${naira(priceN * 100)})` : ""}.</Text> : <>
              {f.inst.map((r, i) => {
                const base = Array.from({ length: Math.max(0, Math.min(courseN, 4) - 1) }, (_, k) => `before_course_${k + 2}`);
                const opts = [...new Set([...base, "custom", r.rule])];
                return (
                  <View key={i} style={{ gap: 8, borderRadius: radius.xl, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, padding: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text size={14} weight="medium">Instalment {i + 1}</Text>{i > 0 && <Pressable accessibilityRole="button" onPress={() => set({ inst: f.inst.filter((_, j) => j !== i) })} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="bad">Remove</Text></Pressable>}</View>
                    <Field label="Name" value={r.label} onChangeText={(v) => setRow(i, { label: v })} />
                    <Field label="Amount (₦)" keyboardType="number-pad" value={r.amount} onChangeText={(v) => setRow(i, { amount: digits(v).slice(0, 9) })} />
                    {i === 0 ? <Text size={14} tone="muted">Due before classes start. Paying it activates the enrolment.</Text>
                      : <SelectSheet label="Due" value={r.rule} options={opts.map((o) => ({ value: o, label: ruleText(o) }))} onChange={(v) => setRow(i, { rule: v })} />}
                  </View>);
              })}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button variant="secondary" style={{ height: 40, flex: 1 }} disabled={f.inst.length >= MAX_INST} onPress={addRow}>+ Add instalment</Button>
                <Button variant="secondary" style={{ height: 40, flex: 1 }} disabled={!(priceN > 0)} onPress={splitEvenly}>Split evenly</Button>
              </View>
              {instTotal > 0 && priceN > 0 && (diff === 0
                ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="check" size={16} color={p.c.ok} /><Text size={14} tone="ok">The instalments add up to the full price.</Text></View>
                : <Text size={14} tone="warn">{`The instalments total ${naira(instTotal * 100)}, ${naira(Math.abs(diff) * 100)} ${diff > 0 ? "more" : "less"} than the full price. They must add up to ${naira(priceN * 100)}.`}</Text>)}
              <Field label="Extra fee for paying in instalments (₦, optional)" keyboardType="number-pad" value={f.fee} onChangeText={(v) => set({ fee: digits(v).slice(0, 9) })} />
              <Text size={14} tone="muted">{"Charged together with the last instalment. It goes to IQ Academy only: instructors and centres don't earn from it."}</Text>
              {f.inst.length > 0 && diff === 0 ? <Text size={14}>{`A student paying in instalments pays ${chargedAmounts(f.inst, f.fee).map((a) => naira(a * 100)).join(", then ")}. Total ${naira((instTotal + (Number(f.fee) || 0)) * 100)}.`}</Text> : null}
            </>}
          </View>

          {show && problems.length > 0 && <View style={{ gap: 4, borderRadius: radius.xl, backgroundColor: p.a("warn", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}>{problems.map((x) => <Text key={x} size={14} tone="warn">• {x}</Text>)}</View>}
          <Err>{err}</Err>
          <Button onPress={save}>Save</Button>
          {f.id && <Button variant="ghost" onPress={remove}><Text size={15} weight="medium" tone="bad">Delete this package…</Text></Button>}
        </View>}
      </Sheet>
    </View>
  );
}
