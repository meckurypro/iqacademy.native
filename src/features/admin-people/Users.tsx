// Port of web pages/Users.tsx. Search everyone; change a person's type. Staff roles tied to branches pick the branches. Saving is online-only (the server decides roles).
import { useState } from "react";
import { Pressable, View } from "react-native";
import { roleLabel, type Role } from "@/core/auth";
import { friendly, ok, rawMessage } from "@/core/errors";
import { mutate, useQuery } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Badge, Button, Card, Chip, ChipRow, Empty, Err, Heading, SearchField, Sheet, Skeleton, Text, useFeedback } from "@/ui";
import { useUserSearch, type UserRow } from "./useUserSearch";

const TYPES: Role[] = ["student", "coordinator", "centre_director", "instructor", "admin"];
const GENERIC = "Something went wrong. Please try again.";

export default function Users() {
  const { p } = useTheme(); const { run, confirm } = useFeedback();
  const [q, setQ] = useState(""); const { rows, refetch } = useUserSearch(q);
  const [sel, setSel] = useState<UserRow | null>(null); const [type, setType] = useState<Role>("student"); const [cs, setCs] = useState<string[]>([]); const [err, setErr] = useState("");
  const cq = useQuery<{ id: string; name: string }[]>({ key: ["userCentres"], tags: ["centres"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("centres").select("id,name").order("name")) as { id: string; name: string }[]) ?? [] });
  const centres = cq.data ?? [];

  const open = (u: UserRow) => {
    const staff = u.roles.find((r) => r.role !== "student");
    setSel(u); setType((staff?.role ?? "student") as Role); setCs(u.roles.filter((r) => r.role === staff?.role && r.centre_id).map((r) => r.centre_id!)); setErr("");
  };
  const needsCentre = type === "coordinator" || type === "centre_director";
  const save = async () => {
    if (!sel) return; setErr("");
    const wasStaff = sel.roles.some((r) => r.role !== "student");
    if (type === "student" && wasStaff && !(await confirm({ title: "Remove staff access?", message: `${sel.full_name || "This person"} becomes a regular student and loses access to everything their current role allows.`, confirmLabel: "Remove access", danger: true }))) return;
    const r = await run("Saving…", async () => needsCentre
      ? mutate.rpc("set_user_centres", { p_user_id: sel.id, p_role: type, p_centre_ids: cs }, { invalidates: ["users", "roles"] })
      : mutate.rpc("set_user_type", { p_user_id: sel.id, p_role: type, p_centre_id: null }, { invalidates: ["users", "roles"] }), { success: `${sel.full_name || "User"} updated`, quiet: true });
    if (!r.ok) return setErr(r.message === GENERIC || friendly(r.error) === GENERIC ? rawMessage(r.error).replace(/^.*?: /, "") || GENERIC : r.message);
    setSel(null); refetch();
  };

  return (
    <View style={{ gap: 16 }}>
      <Heading size={26} lh={32}>Users</Heading>
      <SearchField label="Search users" value={q} onChangeText={setQ} placeholder="Search by name, email or phone" autoCapitalize="none" />
      {!rows ? <View style={{ gap: 8 }}><Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} /></View> :
        rows.length === 0 ? <Empty title={`No one matches “${q.trim()}”.`} /> :
        <View style={{ gap: 12 }}>{rows.map((u) => (
          <Card key={u.id} onPress={() => open(u)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <Avatar name={u.full_name || "?"} url={u.avatar_url} />
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{u.full_name || "(no name)"}{!u.is_active && " · inactive"}</Text><Text size={14} tone="muted" numberOfLines={1}>{u.email}</Text></View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>{u.roles.filter((r) => r.role !== "student").map((r, i) => <Badge key={i} tone="ok">{roleLabel[r.role]}</Badge>)}</View>
          </Card>))}</View>}

      <Sheet open={!!sel} onClose={() => setSel(null)} title="Change user type">
        {sel && <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Avatar name={sel.full_name} size={48} /><View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{sel.full_name}</Text><Text size={14} tone="muted">{sel.email}</Text></View></View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{TYPES.map((r) => (
            <Pressable key={r} accessibilityRole="radio" accessibilityState={{ selected: type === r }} onPress={() => setType(r)} style={{ width: "48.5%", height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: type === r ? p.c.accent : p.c.sunken }}>
              <Text size={14} weight="medium" style={{ color: type === r ? p.c.accentInk : p.c.ink }}>{roleLabel[r]}</Text></Pressable>))}</View>
          {needsCentre && <View style={{ gap: 8 }}><Text size={14} tone="muted">Branches they look after (pick one or more)</Text><ChipRow>{centres.map((c) => <Chip key={c.id} on={cs.includes(c.id)} onPress={() => setCs(cs.includes(c.id) ? cs.filter((x) => x !== c.id) : [...cs, c.id])}>{c.name}</Chip>)}</ChipRow></View>}
          <Text size={14} tone="muted">{"They'll be notified and their app updates straight away."}</Text>
          <Err>{err}</Err>
          <Button disabled={needsCentre && cs.length === 0} onPress={save}>Save</Button>
        </View>}
      </Sheet>
    </View>
  );
}
