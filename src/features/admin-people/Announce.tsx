// Port of web pages/Announce.tsx. Compose an announcement to a set of people (audience rules), and review, correct or retract what was sent.
// Sending, editing and removing are online-only. Divergence: the web pins the "N people will get this / Send" bar to the bottom of the screen; here it is the last card on the page.
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { friendly, ok, rawMessage } from "@/core/errors";
import { mutate, online, useQuery, useRpc } from "@/data";
import { useDebounced } from "@/shared/useDebounced";
import { fmtWhen } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Area, Button, Card, Chip, Empty, Err, Field, Heading, Icon, Segmented, SelectSheet, Sheet, Skeleton, Text, useFeedback } from "@/ui";
import { useUserSearch } from "./useUserSearch";

type Opt = { id: string; name: string };
type Rule = { who: string; centres: string[]; courses: string[]; users: Opt[] };
const WHO = [["students", "Students"], ["instructors", "Instructors"], ["centre_directors", "Centre directors"], ["coordinators", "Coordinators"], ["admins", "Admins"], ["users", "Specific people"], ["everyone", "Everyone"]] as const;
const blank = (): Rule => ({ who: "students", centres: [], courses: [], users: [] });
const GENERIC = "Something went wrong. Please try again.";
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const flip = (a: string[], id: string) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);

function Chips({ items, on, toggle }: { items: Opt[]; on: string[]; toggle: (id: string) => void }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{items.map((i) => <Chip key={i.id} on={on.includes(i.id)} onPress={() => toggle(i.id)}>{i.name}</Chip>)}</View>;
}

function Compose({ onSeeSent }: { onSeeSent: () => void }) {
  const { p } = useTheme(); const { run, confirm } = useFeedback();
  const [rules, setRules] = useState<Rule[]>([blank()]); const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [err, setErr] = useState(""); const [sent, setSent] = useState<number | null>(null); const [find, setFind] = useState("");
  const found = useUserSearch(find.trim()).rows;
  const cq = useQuery<Opt[]>({ key: ["annCentres"], tags: ["centres"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("centres").select("id,name").order("name")) as Opt[]) ?? [] });
  const kq = useQuery<Opt[]>({ key: ["annCourses"], tags: ["courses"], ttlMs: 5 * 60_000, fn: async (sb) => (ok(await sb.from("courses").select("id,name:title").order("sort_order")) as Opt[]) ?? [] });
  const centres = cq.data ?? [], courses = kq.data ?? [];

  const audience = useMemo(() => ({ rules: rules.map((r) => {
    const o: Record<string, unknown> = { who: r.who };
    if (["students", "instructors"].includes(r.who) && r.courses.length) o.course_ids = r.courses;
    if (["students", "instructors", "centre_directors", "coordinators"].includes(r.who) && r.centres.length) o.centre_ids = r.centres;
    if (r.who === "users") o.user_ids = r.users.map((u) => u.id);
    return o; }) }), [rules]);
  const empty = rules.some((r) => r.who === "users" && r.users.length === 0);
  const key = JSON.stringify(audience); const dkey = useDebounced(key, 300);
  const pq = useRpc<{ count: number; sample: { full_name: string }[] }>("preview_audience", { p_audience: JSON.parse(dkey) }, { enabled: !empty, ttlMs: 10_000, tags: ["users"] });
  const preview = !empty && dkey === key ? pq.data : undefined;

  const patch = (i: number, x: Partial<Rule>) => setRules((rs) => rs.map((r, k) => (k === i ? { ...r, ...x } : r)));
  const send = async () => {
    setErr("");
    const n = preview?.count ?? 0;
    if (!(await confirm({ title: `Send to ${people(n)}?`, message: "It goes straight to their notification bell. You can still edit or remove it afterwards from the Sent tab.", confirmLabel: "Send now" }))) return;
    const r = await run("Sending announcement…", async () => {
      const m = await mutate.rpc<{ recipient_count: number }>("send_broadcast", { p_title: title, p_body: body || null, p_audience: audience }, { invalidates: ["broadcasts"] });
      return m.status === "done" ? m.data : { recipient_count: n };
    }, { quiet: true });
    if (!r.ok) return setErr(r.message === GENERIC || friendly(r.error) === GENERIC ? rawMessage(r.error) || GENERIC : r.message);
    setSent(r.data.recipient_count);
  };

  if (sent !== null) return (
    <Card style={{ alignItems: "center", gap: 16, padding: 32, marginTop: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: p.a("ok", 0.15) }}><Icon name="check" size={32} color={p.c.ok} /></View>
      <Heading size={26} lh={32} align="center">Sent to {people(sent)}</Heading><Text tone="muted">{"It's on their notification bell now."}</Text>
      <Button style={{ alignSelf: "stretch" }} onPress={() => { setSent(null); setTitle(""); setBody(""); setRules([blank()]); }}>Write another</Button>
      <Button variant="ghost" style={{ alignSelf: "stretch" }} onPress={onSeeSent}>See sent announcements</Button>
    </Card>);

  return (
    <View style={{ gap: 20 }}>
      {rules.map((r, i) => (
        <Card key={i} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text size={14} weight="medium" tone="muted">{i === 0 ? "Send to" : "Also send to"}</Text>
            {rules.length > 1 && <Pressable accessibilityRole="button" onPress={() => setRules(rules.filter((_, k) => k !== i))} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="bad">Remove</Text></Pressable>}
          </View>
          <SelectSheet label="Audience" value={r.who} options={WHO.map(([v, l]) => ({ value: v, label: l }))} onChange={(v) => patch(i, { ...blank(), who: v })} />
          {["students", "instructors", "centre_directors", "coordinators"].includes(r.who) && <><Text size={14} tone="muted">Only at these centres (leave empty for all)</Text><Chips items={centres} on={r.centres} toggle={(id) => patch(i, { centres: flip(r.centres, id) })} /></>}
          {["students", "instructors"].includes(r.who) && <><Text size={14} tone="muted">Only in these courses</Text><Chips items={courses} on={r.courses} toggle={(id) => patch(i, { courses: flip(r.courses, id) })} /></>}
          {r.who === "users" && <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{r.users.map((u) => (
              <Pressable key={u.id} accessibilityRole="button" accessibilityLabel={`Remove ${u.name}`} onPress={() => patch(i, { users: r.users.filter((x) => x.id !== u.id) })} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: p.c.accent, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text size={14} style={{ color: p.c.accentInk }}>{u.name}</Text><Icon name="close" size={14} color={p.c.accentInk} /></Pressable>))}</View>
            <Field label="Search people" value={find} onChangeText={setFind} placeholder="Search people to add…" autoCapitalize="none" />
            {find.trim() ? found?.slice(0, 5).map((u) => (
              <Pressable key={u.id} accessibilityRole="button" onPress={() => { patch(i, { users: [...r.users.filter((x) => x.id !== u.id), { id: u.id, name: u.full_name }] }); setFind(""); }} style={({ pressed }) => ({ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: pressed ? p.c.sunken : "transparent" })}>
                <Text>{u.full_name}</Text><Text size={14} tone="muted">{u.email}</Text></Pressable>)) : null}
          </View>}
        </Card>))}
      <Button variant="secondary" onPress={() => setRules([...rules, blank()])}>+ Add another group</Button>

      <Card style={{ gap: 12 }}>
        <Field label="Title" value={title} maxLength={120} onChangeText={setTitle} placeholder="e.g. Classes start Monday" />
        <Area label="Message" value={body} onChangeText={setBody} maxLength={2000} rows={4} />
      </Card>
      <Err>{err}</Err>
      <Card variant="glass" style={{ gap: 12 }}>
        <Text size={14} num>{empty ? "Add at least one person" : preview ? <><Text weight="semibold" size={14}>{preview.count}</Text>{` ${preview.count === 1 ? "person" : "people"} will get this`}{preview.sample[0] ? <Text size={14} tone="muted">{` · ${preview.sample.slice(0, 2).map((s) => s.full_name.split(" ")[0]).join(", ")}…`}</Text> : null}</> : "Counting…"}</Text>
        <Button disabled={!title.trim() || !preview || preview.count === 0} onPress={send}>Send</Button>
      </Card>
    </View>
  );
}

type SentRow = { id: string; title: string; body: string | null; recipient_count: number; created_at: string };

function SentList() {
  const { run, confirm, toast } = useFeedback();
  const [ed, setEd] = useState<{ id: string; title: string; body: string; n: number } | null>(null); const [err, setErr] = useState("");
  const q = useQuery<SentRow[]>({ key: ["broadcasts"], tags: ["broadcasts"], ttlMs: 30_000, fn: async (sb) => (ok(await sb.from("broadcasts").select("id,title,body,recipient_count,created_at").order("created_at", { ascending: false }).limit(50)) as SentRow[]) ?? [] });
  const rows = q.data ?? (q.error ? [] : undefined); const loadErr = q.error ? friendly(q.error) : "";

  const save = async () => {
    if (!ed) return; setErr("");
    const sent = ed;
    const r = await run("Saving announcement…", async () => {
      await mutate.rpc("edit_broadcast", { p_id: sent.id, p_title: sent.title, p_body: sent.body.trim() || null }, { invalidates: ["broadcasts"] });
      // Read it back: only call it saved if the database really holds the new wording.
      const back = await online(async (sb) => sb.from("broadcasts").select("title,body").eq("id", sent.id).maybeSingle());
      if (back.error) throw back.error;
      if (!back.data || back.data.title !== sent.title.trim() || (back.data.body ?? "") !== sent.body.trim()) throw new Error("not_saved");
      await q.refetch();
    }, { success: "Updated for everyone who received it", quiet: true });
    if (!r.ok) return setErr(r.message);
    setEd(null);
  };
  const remove = async (b: SentRow) => {
    if (!(await confirm({ title: "Remove this announcement?", message: `“${b.title}” disappears from the notifications of the ${people(b.recipient_count)} who received it, including anyone who hasn't read it yet. This can't be undone.`, confirmLabel: "Remove announcement", danger: true }))) return;
    const r = await run("Removing announcement…", async () => { const m = await mutate.rpc<number>("delete_broadcast", { p_id: b.id }, { invalidates: ["broadcasts"] }); await q.refetch(); return m.status === "done" ? m.data : 0; });
    if (r.ok) toast(`Removed from ${people(r.data)}'s notifications`);
  };

  return (
    <View style={{ gap: 16 }}>
      <View><Heading size={26} lh={32}>Sent announcements</Heading><Text size={14} tone="muted">Fix a typo or take one back. Changes apply to everyone who received it, and nobody is notified again.</Text></View>
      {loadErr ? <View style={{ gap: 8 }}><Err>{loadErr}</Err><Button variant="secondary" onPress={() => q.refetch()}>Try again</Button></View> : null}
      {!rows ? <><Skeleton height={96} /><Skeleton height={96} /></> : rows.length === 0 && !loadErr ? <Empty title="Nothing sent yet." /> : rows.map((b) => (
        <Card key={b.id} style={{ gap: 8 }}>
          <View><Text weight="medium">{b.title}</Text><Text size={14} tone="muted">{fmtWhen(b.created_at, { dateStyle: "medium", timeStyle: "short" })} · sent to {people(b.recipient_count)}</Text></View>
          {b.body ? <Text numberOfLines={3}>{b.body}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary" style={{ height: 40, flex: 1 }} onPress={() => { setErr(""); setEd({ id: b.id, title: b.title, body: b.body ?? "", n: b.recipient_count }); }}>Edit</Button>
            <Button variant="secondary" style={{ height: 40, flex: 1 }} onPress={() => remove(b)}><Text size={15} weight="medium" tone="bad">Remove</Text></Button>
          </View>
        </Card>))}
      <Sheet open={!!ed} onClose={() => setEd(null)} title="Edit announcement">
        {ed && <View style={{ gap: 12 }}>
          <Field label="Title" value={ed.title} maxLength={120} onChangeText={(t) => setEd({ ...ed, title: t })} />
          <Area label="Message" value={ed.body} onChangeText={(t) => setEd({ ...ed, body: t })} maxLength={2000} rows={5} />
          <Text size={14} tone="muted">This changes the wording for all {ed.n} {ed.n === 1 ? "person" : "people"} who received it. They aren{"'"}t notified again.</Text>
          <Err>{err}</Err>
          <Button disabled={!ed.title.trim()} onPress={save}>Save changes</Button>
        </View>}
      </Sheet>
    </View>
  );
}

export default function Announce() {
  const [tab, setTab] = useState<"new" | "sent">("new");
  return (
    <View style={{ gap: 16 }}>
      <Segmented value={tab} onChange={setTab} options={[{ value: "new", label: "New announcement" }, { value: "sent", label: "Sent" }]} />
      {tab === "new" ? <Compose onSeeSent={() => setTab("sent")} /> : <SentList />}
    </View>
  );
}
