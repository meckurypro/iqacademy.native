// Port of web components/SoloPrices.tsx. Admin: what each course costs when a student buys it on its own. A second price covers students who haven't completed the course's
// prerequisite. Leave a price empty and that course can't be bought on its own. After saving, the prices are read back and checked. Online-only.
import { useState } from "react";
import { TextInput, View } from "react-native";
import { friendly, naira } from "@/core/errors";
import { online, useQuery } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Button, Card, Err, Heading, Skeleton, Text, useFeedback } from "@/ui";
import { digits, toKobo } from "./pricing";

type Row = { course_id: string; title: string; hasPrereq: boolean; price: string; unmet: string };
const naira9 = (s: string) => digits(s).slice(0, 9);
const kobo = (s: string) => (s ? toKobo(s) : null);

async function fetchRows(sb: Parameters<Parameters<typeof online>[0]>[0]): Promise<Row[]> {
  const [c, p, q] = await Promise.all([
    sb.from("courses").select("id,title").eq("is_active", true).order("sort_order"),
    sb.from("course_prices").select("course_id,solo_price,solo_price_unmet"),
    sb.from("course_prerequisites").select("course_id"),
  ]);
  if (c.error) throw c.error; if (p.error) throw p.error; if (q.error) throw q.error;
  const price = new Map((p.data ?? []).map((x) => [x.course_id as string, x])); const pre = new Set((q.data ?? []).map((x) => x.course_id as string));
  return (c.data ?? []).map((x) => { const r = price.get(x.id as string); return { course_id: x.id as string, title: x.title as string, hasPrereq: pre.has(x.id as string), price: r?.solo_price ? String(r.solo_price / 100) : "", unmet: r?.solo_price_unmet ? String(r.solo_price_unmet / 100) : "" }; });
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { p } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text size={14} tone="muted" style={{ flex: 1 }}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardType="number-pad" placeholder="Not set" placeholderTextColor={p.a("muted", 0.6)} value={value} onChangeText={(v) => onChange(naira9(v))} selectionColor={p.c.accent}
        style={{ width: 144, height: 44, borderRadius: radius.xl, backgroundColor: p.c.sunken, paddingHorizontal: 12, textAlign: "right", fontFamily: "Geist-Regular", fontSize: 15, color: p.c.ink }} />
    </View>
  );
}

export default function SoloPrices() {
  const { run } = useFeedback();
  const q = useQuery<Row[]>({ key: ["soloPrices"], tags: ["packages", "courses"], ttlMs: 0, fn: (sb) => fetchRows(sb) });
  const [draft, setDraft] = useState<Row[] | null>(null); const [err, setErr] = useState("");
  const base = q.data; const rows = draft ?? base;
  if (q.error && !base) return <Err>{friendly(q.error)}</Err>;
  if (!rows || !base) return <Skeleton height={112} />;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(base);
  const set = (i: number, patch: Partial<Row>) => setDraft(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setErr(""); const sent = rows;
    const r = await run("Saving prices…", async () => {
      await online(async (sb) => {
        const { error } = await sb.rpc("save_course_prices", { p_prices: sent.map((x) => ({ course_id: x.course_id, solo_price: kobo(x.price), solo_price_unmet: x.hasPrereq ? kobo(x.unmet) : null })) });
        if (error) throw error;
        // Read the prices back: only call it saved if the database really holds them.
        const back = await sb.from("course_prices").select("course_id,solo_price,solo_price_unmet");
        if (back.error) throw back.error;
        const have = new Map((back.data ?? []).map((x) => [x.course_id as string, x]));
        for (const x of sent) { const h = have.get(x.course_id); if ((h?.solo_price ?? null) !== kobo(x.price) || (x.hasPrereq && (h?.solo_price_unmet ?? null) !== kobo(x.unmet))) throw new Error("not_saved"); }
      }, { invalidates: ["packages"] });
      await q.refetch();
    }, { success: "Prices saved. Students see them when they buy a single course.", quiet: true });
    if (!r.ok) return setErr(r.message);
    setDraft(null);
  };

  return (
    <View style={{ gap: 12 }}>
      <View><Heading size={18}>Single-course prices</Heading><Text size={14} tone="muted">What a student pays to buy one course on their own, after paying for a pack. This is also the price to take a course again. Leave empty to keep a course off the list.</Text></View>
      {rows.map((r, i) => (
        <Card key={r.course_id} style={{ gap: 8 }}>
          <Text weight="medium">{r.title}</Text>
          <Money label={r.hasPrereq ? "Price, prerequisite completed (₦)" : "Price (₦)"} value={r.price} onChange={(v) => set(i, { price: v })} />
          {r.hasPrereq && <Money label="Price, prerequisite not completed (₦)" value={r.unmet} onChange={(v) => set(i, { unmet: v })} />}
          {r.hasPrereq && r.price && r.unmet && Number(r.unmet) < Number(r.price) && <Text size={14} tone="warn">The “not completed” price is lower than the “completed” price ({naira(Number(r.unmet) * 100)} vs {naira(Number(r.price) * 100)}).</Text>}
        </Card>))}
      <Err>{err}</Err>
      <Button disabled={!dirty} onPress={save}>{dirty ? "Save prices" : "Saved"}</Button>
    </View>
  );
}
