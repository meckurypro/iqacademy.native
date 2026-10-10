// Port of web pages/Team.tsx. Centre team: directors (added by admin) and coordinators (added by the director or admin).
// Admins reach this from a centre's card on the Centres page, so a centre is always chosen up front. Directors land on their own centre(s).
// Every change here is online-only (roles are decided by the server).
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { friendly, ok } from "@/core/errors";
import { mutate, useQuery, useRpc } from "@/data";
import { useDebounced } from "@/shared/useDebounced";
import { place, placeLabel } from "@/shared/web/centre";
import { Avatar, Badge, Button, Card, Empty, Err, Field, Icon, List, Place, Segmented, SelectSheet, Skeleton, Text, useFeedback } from "@/ui";
import { PageTitle } from "./PageTitle";

type Member = { user_id: string; role: "coordinator" | "centre_director"; full_name: string; avatar_url: string | null };
type Hit = { id: string; full_name: string; avatar_url: string | null; email_hint: string | null };
type CentreRow = { id: string; name: string; city: string | null; address: string | null };
const LABEL = { centre_director: "Director", coordinator: "Coordinator" } as const;

export default function Team({ centreId }: { centreId?: string }) {
  const { roles } = useAuth(); const router = useRouter();
  const isAdmin = roles.some((r) => r.role === "admin" || r.role === "super_admin");
  if (isAdmin && !centreId) return <Redirect href="/centres" />;
  return <TeamPage key={centreId ?? "mine"} centreId={centreId} isAdmin={isAdmin} back={() => router.navigate("/centres")} />;
}

function TeamPage({ centreId, isAdmin, back }: { centreId?: string; isAdmin: boolean; back: () => void }) {
  const { roles } = useAuth(); const { run, confirm } = useFeedback();
  const myCentres = [...new Set(roles.filter((r) => r.role === "centre_director" && r.centre_id).map((r) => r.centre_id as string))];
  const [pick, setPick] = useState(centreId ?? myCentres[0] ?? ""); const cid = pick;
  const [q, setQ] = useState(""); const [role, setRole] = useState<"coordinator" | "centre_director">("coordinator"); const [err, setErr] = useState("");

  const cq = useQuery<CentreRow[]>({ key: ["teamCentres", isAdmin, myCentres], tags: ["centres", "roles"], ttlMs: 10 * 60_000,
    fn: async (sb) => { const all = (ok(await sb.from("centres").select("id,name,city,address").order("name")) as CentreRow[]) ?? []; return isAdmin ? all : all.filter((c) => myCentres.includes(c.id)); } });
  const centreObj = cq.data?.find((c) => c.id === cid); const centreName = centreObj ? place(centreObj) : undefined;
  const tq = useRpc<Member[]>("centre_team", { p_centre_id: cid }, { enabled: !!cid, tags: ["team", "roles"], ttlMs: 30_000 });
  const team = tq.data; const loadErr = tq.error ? friendly(tq.error) : "";
  const dq = useDebounced(q.trim(), 250);
  const sq = useRpc<Hit[]>("lookup_user", { p_query: dq }, { enabled: dq.length >= 3, ttlMs: 20_000 });
  const hits = dq.length >= 3 && dq === q.trim() ? sq.data ?? [] : [];

  const add = async (h: Hit) => {
    setErr("");
    const r = await run(`Adding ${String(h.full_name).split(" ")[0]}…`, async () => {
      const m = role === "coordinator" ? await mutate.rpc("add_centre_coordinator", { p_user_id: h.id, p_centre_id: cid }, { invalidates: ["team"] }) : await mutate.rpc("assign_role", { p_user_id: h.id, p_role: "centre_director", p_centre_id: cid }, { invalidates: ["team", "roles"] });
      return m;
    }, { success: `${h.full_name} added to the team`, quiet: true });
    if (!r.ok) return setErr(r.message);
    setQ(""); tq.refetch();
  };
  const remove = async (m: Member) => {
    if (!(await confirm({ title: `Remove ${m.full_name}?`, message: `They lose their ${m.role === "coordinator" ? "coordinator" : "director"} access${centreName ? ` at ${centreName}` : ""}. Their account stays.`, confirmLabel: "Remove", danger: true }))) return;
    setErr("");
    const r = await run(`Removing ${String(m.full_name).split(" ")[0]}…`, async () => (m.role === "coordinator"
      ? mutate.rpc("remove_centre_coordinator", { p_user_id: m.user_id, p_centre_id: cid }, { invalidates: ["team"] })
      : mutate.rpc("remove_role", { p_user_id: m.user_id, p_role: "centre_director", p_centre_id: cid }, { invalidates: ["team", "roles"] })), { success: `${m.full_name} removed`, quiet: true });
    if (!r.ok) return setErr(r.message);
    tq.refetch();
  };

  return (
    <View style={{ gap: 20 }}>
      {isAdmin && <Pressable accessibilityRole="link" onPress={back} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44 }}><Icon name="arrowLeft" size={16} /><Text size={14} tone="muted">Centres</Text></Pressable>}
      <PageTitle title={isAdmin ? "Centre team" : "My team"} sub={centreName && (isAdmin || myCentres.length <= 1) && centreObj ? <Place centre={centreObj} nameOnly tone="muted" /> : undefined} />
      {!isAdmin && myCentres.length > 1 && <SelectSheet label="Branch" value={cid} options={(cq.data ?? []).map((c) => ({ value: c.id, label: placeLabel(c) }))} onChange={setPick} />}
      {!cid ? <Empty title="You're not assigned to a centre yet." /> : <>
        <Err>{loadErr}</Err>
        {!team ? <Skeleton height={64} /> : team.length === 0 ? <Empty title="No team members yet." /> : <List>{team.map((m) => (
          <View key={m.user_id + m.role} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Avatar name={m.full_name} url={m.avatar_url} size={36} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text weight="medium" numberOfLines={1}>{m.full_name}</Text><Badge tone={m.role === "centre_director" ? "ok" : "muted"}>{LABEL[m.role]}</Badge></View>
            {(m.role === "coordinator" || isAdmin) && <Button variant="ghost" style={{ height: 36, paddingHorizontal: 12 }} onPress={() => remove(m)}><Text size={14} tone="bad" weight="medium">Remove</Text></Button>}
          </View>))}</List>}
        <Card style={{ gap: 12, padding: 14 }}>
          <Text weight="medium">Add someone who already has an account</Text>
          {isAdmin && <Segmented value={role} onChange={setRole} options={[{ value: "coordinator", label: "Coordinator" }, { value: "centre_director", label: "Director" }]} />}
          <Field label="Search" value={q} onChangeText={setQ} placeholder="Search by name or email (3+ letters)" autoCapitalize="none" autoCorrect={false} />
          {hits.map((h) => (
            <Pressable key={h.id} accessibilityRole="button" onPress={() => add(h)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
              <Avatar name={h.full_name} url={h.avatar_url} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{h.full_name}</Text><Text size={14} tone="muted" numberOfLines={1}>{h.email_hint}</Text></View>
              <Text size={14} tone="accent">Add</Text>
            </Pressable>))}
          {q.trim().length >= 3 && dq === q.trim() && !sq.loading && hits.length === 0 && <Text size={14} tone="muted">No one found. They need to create an account in the app first.</Text>}
          <Err>{err}</Err>
        </Card>
      </>}
    </View>
  );
}
