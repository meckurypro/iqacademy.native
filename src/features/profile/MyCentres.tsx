// src/features/profile/MyCentres.tsx
// Port of web components/MyCentres.tsx: where a student is registered (town, name, address) and where that registration stands.
// Shows nothing for people with no registration (staff, new accounts), so it can sit on any profile.
import { View } from "react-native";
import { ok } from "@/core/errors";
import { useQuery } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Card, Icon, Place, Section } from "@/ui";

type Centre = { id: string; name: string; city: string | null; address: string | null };
type Row = { id: string; status: "active" | "pending_payment" | "completed"; centres: Centre | null };
const RANK = { active: 0, pending_payment: 1, completed: 2 } as const;
const STATE = { active: { tone: "ok", text: "Registered" }, pending_payment: { tone: "warn", text: "Awaiting payment" }, completed: { tone: "muted", text: "Completed" } } as const;

export default function MyCentres() {
  const { p } = useTheme();
  const q = useQuery<Row[]>({ key: ["my-centres"], tags: ["enrolments"], ttlMs: 2 * 60_000,
    fn: async (sb) => (ok(await sb.from("enrolments").select("id,status,centres(id,name,city,address)").in("status", ["pending_payment", "active", "completed"]).order("created_at", { ascending: false })) as unknown as Row[]) ?? [] });
  if (!q.data) return null;
  // one card per centre; if a student has several registrations there, the most current one speaks for it
  const byCentre = new Map<string, Row>();
  for (const r of q.data) if (r.centres && (!byCentre.has(r.centres.id) || RANK[r.status] < RANK[byCentre.get(r.centres.id)!.status])) byCentre.set(r.centres.id, r);
  const list = [...byCentre.values()].sort((a, b) => RANK[a.status] - RANK[b.status]);
  if (list.length === 0) return null;
  return (
    <Section title={list.length === 1 ? "Your centre" : "Your centres"}>
      {list.map((r) => (
        <Card key={r.centres!.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ marginTop: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: p.c.sunken, alignItems: "center", justifyContent: "center" }}><Icon name="pin" size={18} color={p.c.muted} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Place centre={r.centres!} /></View>
          <Badge tone={STATE[r.status].tone}>{STATE[r.status].text}</Badge>
        </Card>
      ))}
    </Section>
  );
}
