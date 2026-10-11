// Port of web pages/ClassScreen.tsx. The live class: roster, the door code + QR (full-screen at the door), hand check-in, who was turned away, the class channel, end/cancel.
// Rules kept exactly as the web: door staff are this centre's coordinator, any admin, and the instructor of a custom class; directors only see numbers. The class code shows only after the
// staff member's own door PIN (admins are not asked). Checking someone in by hand needs the student's own PIN (an admin may instead write a reason) and works only while check-in is open.
// Every write is online-only and decided by the server. Divergences: attendance comes from the cache and refreshes on the shared realtime tags; the code is held in memory, never cached on disk.
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import QRCode from "react-native-qrcode-svg";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/core/auth";
import { friendly, ok } from "@/core/errors";
import { online, useQuery, useRpc } from "@/data";
import ChatBubble from "@/features/channels/ChatBubble";
import Composer from "@/features/channels/Composer";
import type { ClassMessage } from "@/features/channels/format";
import { REASON_LABEL, doorState, opensAt } from "@/shared/checkin";
import { useTicker } from "@/shared/useTicker";
import { fmtClock } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Area, Avatar, Badge, Button, Card, Chip, Empty, Err, Icon, List, NavRow, PIN_LENGTH, PinInput, Place, Section, Sheet, Skeleton, Text, useFeedback } from "@/ui";
import DoorPinSheet from "./DoorPinSheet";
import { needsDoorPin, useDoorUnlocked } from "./doorLock";

type Row = { student_id: string; full_name: string; status: "present" | "absent" | "excused" | null; method: string | null };
type Denied = { student_id: string; full_name: string; reason: string; attempts: number; last_at: string };
type Sess = { id: string; centre_id: string; start_at: string; end_at: string; status: string; centre_name: string; centre_city: string | null; centre_address: string | null; course_title: string; lesson_title: string | null; lesson_summary: string | null; room: string | null; is_emergency: boolean };
type Loaded = { s: Sess; roster: Row[]; teacher: string | null; ended: { reason: string; at: string } | null };
const tone = { present: "ok", absent: "bad", excused: "warn" } as const;
const HOW: Record<string, string> = { qr_scan: "Scanned", centre_staff: "By centre staff", instructor: "By instructor", admin: "By admin" };
const END_REASONS = ["Emergency", "Technical problem", "Not feeling well", "Finished early"];
const TAGS = ["sessions", "attendance"];

function Ring({ value, total }: { value: number; total: number }) {
  const { p } = useTheme(); const R = 34, C = 2 * Math.PI * R, f = total ? Math.min(1, value / total) : 0;
  return (
    <View style={{ width: 80, height: 80, alignItems: "center", justifyContent: "center" }}>
      <Svg width={80} height={80} viewBox="0 0 80 80" style={{ position: "absolute" }}>
        <Circle cx={40} cy={40} r={R} stroke={p.c.sunken} strokeWidth={9} fill="none" />
        <Circle cx={40} cy={40} r={R} stroke={p.c.accent} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={`${C * f} ${C}`} transform="rotate(-90 40 40)" />
      </Svg>
      <Text size={20} weight="semibold" num>{value}</Text>
    </View>
  );
}

/** The code at the door: big, white, and the screen stays awake while it is up. */
function CodeModal({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => { if (!open) return; void activateKeepAwakeAsync("door-code"); return () => { void deactivateKeepAwake("door-code"); }; }, [open]);
  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", gap: 20, padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <Text size={14} style={{ color: "#555" }}>Class code</Text>
        {code ? <QRCode value={code} size={280} backgroundColor="#fff" color="#000" /> : null}
        <Text size={44} weight="semibold" num style={{ color: "#000", letterSpacing: 10 }}>{code}</Text>
        <Text size={14} align="center" style={{ color: "#555", maxWidth: 300 }}>Students scan the QR or type this code in their app. It stops working when the class ends.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ minHeight: 48, paddingHorizontal: 32, borderRadius: 24, backgroundColor: "#eee", alignItems: "center", justifyContent: "center" }}><Text weight="medium" style={{ color: "#000" }}>Close</Text></Pressable>
      </View>
    </Modal>
  );
}

export default function ClassScreen({ id, reveal }: { id: string; reveal?: string }) {
  const { p } = useTheme(); const router = useRouter(); const { run, confirm } = useFeedback(); const { session, roles } = useAuth(); const uid = session?.user.id;
  const now = useTicker(30_000);

  const q = useQuery<Loaded>({
    key: ["classScreen", id], tags: TAGS, ttlMs: 10_000,
    fn: async (sb) => {
      const [a, b, c] = await Promise.all([
        sb.from("v_session_details").select("id,centre_id,start_at,end_at,status,centre_name,centre_city,centre_address,course_title,lesson_title,lesson_summary,room,is_emergency").eq("id", id).single(),
        sb.rpc("session_attendance_roster", { p_session_id: id }),
        sb.from("class_sessions").select("instructor_id,end_reason,ended_early_at").eq("id", id).maybeSingle(),
      ]);
      if (a.error) throw a.error; if (b.error) throw b.error;
      const d = c.data as { instructor_id: string | null; end_reason: string | null; ended_early_at: string | null } | null;
      return { s: a.data as Sess, roster: (b.data as Row[]) ?? [], teacher: d?.instructor_id ?? null, ended: d?.end_reason && d.ended_early_at ? { reason: d.end_reason, at: d.ended_early_at } : null };
    },
  });
  const s = q.data?.s; const roster = q.data?.roster; const teacher = q.data?.teacher ?? null; const ended = q.data?.ended ?? null;
  const isAdmin = roles.some((r) => r.role === "admin" || r.role === "super_admin");
  const isTeacher = !!teacher && teacher === uid;
  // Door staff (this centre's coordinator, or an admin) open check-in and see who was turned away. Directors do not. The instructor of a custom class opens its check-in too.
  const isDoor = !!s && (isAdmin || roles.some((r) => r.role === "coordinator" && r.centre_id === s.centre_id) || (s.is_emergency && isTeacher));
  const canMark = isDoor || isTeacher; const canSend = isAdmin || isTeacher;
  const unlocked = useDoorUnlocked(uid); const locked = needsDoorPin(roles) && !unlocked;

  const dq = useRpc<Denied[]>("session_denied_attempts", { p_session_id: id }, { enabled: isDoor, tags: ["checkins"], ttlMs: 10_000 });
  const mq = useQuery<ClassMessage[]>({
    key: ["classSent", id], enabled: canSend, tags: ["messages"], ttlMs: 30_000,
    fn: async (sb) => (ok(await sb.from("class_messages").select("id,session_id,sender_label,body,media_path,media_name,media_mime,media_size,created_at").eq("session_id", id).order("created_at")) as ClassMessage[]) ?? [],
  });
  const denied = isDoor ? dq.data ?? [] : []; const sent = mq.data ?? [];

  const [code, setCode] = useState(""); const [codeErr, setCodeErr] = useState(""); const [full, setFull] = useState(false);
  const [gateOpen, setGateOpen] = useState(false); const afterUnlock = useRef<(() => void) | null>(null);
  const [pick, setPick] = useState<Row | null>(null); const [err, setErr] = useState("");
  const [endOpen, setEndOpen] = useState(false); const [endWhy, setEndWhy] = useState(""); const [endErr, setEndErr] = useState("");
  const [pinFor, setPinFor] = useState<Row | null>(null); const [pinVal, setPinVal] = useState(""); const [pinErr, setPinErr] = useState(""); const [override, setOverride] = useState(false); const [overrideWhy, setOverrideWhy] = useState("");
  const requireDoor = (then?: () => void) => { if (!locked) return then?.(); afterUnlock.current = then ?? null; setGateOpen(true); };
  const reload = async () => { await q.refetch(); };

  // The class code is made by the class clock 30 minutes before the class and removed when it ends. If the clock hasn't run yet (once a minute), ask for it directly.
  const door0 = s ? doorState(s.start_at, s.end_at, now) : "early"; const st0 = s?.status;
  const codeOk = isDoor && !locked && door0 === "open" && st0 !== "completed" && st0 !== "cancelled";
  useEffect(() => {
    if (!codeOk) return; let alive = true;
    (async () => {
      try {
        const got = await online(async (sb) => await sb.from("session_checkin_tokens").select("token").eq("session_id", id).maybeSingle());
        if (got.data?.token) { if (alive) { setCode(got.data.token as string); setCodeErr(""); } return; }
        const r = await online(async (sb) => await sb.rpc("generate_checkin_token", { p_session_id: id, p_rotate: false }));
        if (alive && !r.error) { setCode(r.data as string); setCodeErr(""); } else if (alive) setCodeErr(friendly(r.error));
      } catch (e) { if (alive) setCodeErr(friendly(e)); }
    })();
    return () => { alive = false; };
  }, [codeOk, id]);
  const shown = codeOk ? code : "";

  // "Reveal code" on the home countdown lands here with ?reveal=1: show the QR full screen as soon as the code is ready, or ask for the PIN first
  useEffect(() => { if (reveal && shown) queueMicrotask(() => { setFull(true); router.setParams({ reveal: undefined }); }); }, [reveal, shown, router]);
  useEffect(() => { if (reveal && isDoor && locked && door0 === "open") queueMicrotask(() => setGateOpen(true)); }, [reveal, isDoor, locked, door0]);

  const act = async (label: string, fn: (sb: Parameters<Parameters<typeof online>[0]>[0]) => PromiseLike<{ error: unknown }>, after?: () => void, success?: string) => {
    setErr("");
    const r = await run(label, async () => { await online(async (sb) => { const { error } = await fn(sb); if (error) throw error; }, { invalidates: TAGS }); await reload(); }, { success, quiet: true });
    if (!r.ok) return setErr(r.message);
    after?.();
  };
  const newCode = async () => {
    setErr("");
    const r = await run("Making a new code…", async () => online(async (sb) => { const { data, error } = await sb.rpc("generate_checkin_token", { p_session_id: id, p_rotate: true }); if (error) throw error; return data as string; }, { invalidates: TAGS }), { quiet: true });
    if (!r.ok) return setErr(r.message);
    setCode(r.data);
  };
  const cancelClass = async () => {
    if (await confirm({ title: "Cancel this class?", message: "Students are told it's cancelled.", confirmLabel: "Cancel class", cancelLabel: "Keep class", danger: true }))
      await act("Cancelling class…", (sb) => sb.rpc("cancel_session", { p_session_id: id, p_reason: "Cancelled by instructor" }), undefined, "Class cancelled");
  };
  const askPin = (r: Row) => { setPick(null); setPinVal(""); setPinErr(""); setOverride(false); setOverrideWhy(""); setPinFor(r); };
  const checkInByHand = async () => {
    if (!pinFor) return;
    const first = pinFor.full_name.split(" ")[0];
    if (override ? overrideWhy.trim().length < 5 : pinVal.length !== PIN_LENGTH) return setPinErr(override ? "Give a reason, in a few words." : "Enter the 4-digit PIN.");
    setPinErr(""); let verdict = "";
    const r = await run("Checking in…", async () => {
      await online(async (sb) => {
        const { data, error } = await sb.rpc("mark_attendance", { p_session_id: id, p_student_id: pinFor.student_id, p_status: "present", ...(override ? { p_override_reason: overrideWhy.trim() } : { p_pin: pinVal }) });
        if (error) throw error;
        if (data !== "ok") { verdict = String(data); throw new Error(verdict); }
      }, { invalidates: TAGS });
      await reload();
    }, { success: `${first} checked in`, quiet: true });
    if (r.ok) return setPinFor(null);
    setPinVal("");
    if (verdict === "already_present") { setPinFor(null); setPinErr(""); await reload(); return; } // nothing was changed; the list now shows them present
    if (verdict === "pin_not_set" && isAdmin) { setOverride(true); setPinErr(`${first} hasn't set a PIN. You can check them in with a reason. They'll be told, and can dispute it.`); } else setPinErr(r.message);
  };
  const openEnd = () => { setEndWhy(""); setEndErr(""); setEndOpen(true); };
  const endClass = async () => {
    const why = endWhy.trim();
    if (why.length < 5) return setEndErr("Give a reason, in a few words, so we know why the class ended early.");
    setEndErr("");
    const r = await run("Ending class…", async () => { await online(async (sb) => { const { error } = await sb.rpc("end_class_early", { p_session_id: id, p_reason: why }); if (error) throw error; }, { invalidates: TAGS }); await reload(); }, { success: "Class ended", quiet: true });
    if (!r.ok) return setEndErr(r.message);
    setEndOpen(false);
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const Back = <Pressable accessibilityRole="link" onPress={back} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44 }}><Icon name="arrowLeft" size={16} /><Text size={14} tone="muted">Back</Text></Pressable>;

  if (q.error && !s) return <View style={{ gap: 12 }}>{Back}<Empty icon="alert" title="Couldn't open this class" hint={friendly(q.error)} /><Button variant="secondary" onPress={reload}>Try again</Button></View>;
  if (!s || !roster) return <View style={{ gap: 12 }}><Skeleton height={32} style={{ width: "66%" }} /><Skeleton height={128} /><Skeleton height={192} /></View>;

  const present = roster.filter((r) => r.status === "present").length;
  const closed = s.status === "completed" || s.status === "cancelled"; const door = doorState(s.start_at, s.end_at, now);
  const handOpen = !closed && door === "open"; // by hand only while the class code is live: 30 minutes before the start until the class ends
  const t = (d: string) => fmtClock(d);
  const chatOpen = s.status === "in_progress" || s.status === "completed" || door === "open";

  return (
    <View style={{ gap: 20 }}>
      {Back}
      <View>
        <Text size={26} weight="semibold" lh={32}>{s.course_title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}><Text tone="muted">{`${s.is_emergency ? "Custom class · " : ""}${s.lesson_title ? `${s.lesson_title} · ` : ""}${t(s.start_at)} – ${t(s.end_at)} · `}</Text><Place centre={{ name: s.centre_name, city: s.centre_city, address: s.centre_address }} nameOnly tone="muted" />{s.room ? <Text tone="muted">{` · ${s.room}`}</Text> : null}</View>
      </View>

      {ended && s.status === "completed" && <Card style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: p.a("warn", 0.1) }}><Icon name="alert" size={18} color={p.c.warn} /></View>
        <View style={{ flex: 1 }}><Text weight="medium">Ended early at {fmtClock(ended.at)}</Text><Text size={14} tone="muted">{ended.reason}</Text></View>
      </Card>}

      {(s.lesson_title || s.lesson_summary) && <Card style={{ gap: 4 }}>
        <Text size={14} tone="muted">{"Today's topic"}</Text><Text weight="medium">{s.lesson_title ?? "No topic set for this class"}</Text>
        {s.lesson_summary ? <Text size={14} tone="muted">{s.lesson_summary}</Text> : null}
      </Card>}

      <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Ring value={present} total={roster.length} />
        <View style={{ flex: 1 }}><Text weight="medium">{present} of {roster.length} here</Text><Text size={14} tone="muted">{closed ? (s.status === "cancelled" ? "Class cancelled" : "Class closed") : "Updates live as students check in"}</Text></View>
      </Card>

      {!closed && isDoor && <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text weight="medium">Check-in</Text><Badge tone={door === "open" ? "ok" : "muted"}>{door === "open" ? "Open" : door === "early" ? "Not yet" : "Ended"}</Badge></View>
        {door === "early" && <Text size={14} tone="muted">The class code is created automatically at {opensAt(s.start_at)}, 30 minutes before the class. Nothing to press.</Text>}
        {door === "ended" && <Text size={14} tone="muted">This class has ended, so check-in is closed. The class closes by itself and absentees are logged.</Text>}
        {door === "open" && (locked ? <>
          <Text size={14} tone="muted">Enter your PIN to show the class code.</Text>
          <Button icon="lock" onPress={() => requireDoor()}>Enter PIN</Button>
        </> : shown ? <>
          <Pressable accessibilityRole="imagebutton" accessibilityLabel="Show the class code full screen" onPress={() => setFull(true)} style={{ alignSelf: "center", borderRadius: radius["2xl"], backgroundColor: "#fff", padding: 12 }}><QRCode value={shown} size={176} backgroundColor="#fff" color="#000" /></Pressable>
          <Text size={30} weight="semibold" num align="center" style={{ letterSpacing: 6 }}>{shown}</Text>
          <Text size={14} tone="muted" align="center">Students scan the QR or type this code. It stops working when the class ends.</Text>
          <View style={{ flexDirection: "row", gap: 12 }}><Button icon="scan" style={{ flex: 1 }} onPress={() => setFull(true)}>Full screen</Button><Button variant="secondary" style={{ flex: 1 }} onPress={newCode}>New code</Button></View>
        </> : <Text size={14} tone={codeErr ? "bad" : "muted"}>{codeErr || "Getting the class code…"}</Text>)}
      </Card>}
      {!closed && !isDoor && isTeacher && <Card><Text size={14} tone="muted">{door === "early" ? "The centre's check-in code appears 30 minutes before the class. The class starts and ends by itself." : "Check-in is open. Students appear below as they arrive. The class ends by itself at its scheduled time."}</Text></Card>}
      <Err>{err}</Err>

      <Section title="Students">
        {canMark && !closed && (handOpen
          ? roster.some((r) => !r.status) && <Text size={14} tone="muted">{"Tap Check in for anyone who can't scan the code. Tap a name to mark absent or excused."}</Text>
          : door === "early" && <Text size={14} tone="muted">Checking students in by hand opens at {opensAt(s.start_at)}, when the class code does.</Text>)}
        {roster.length === 0 && <Empty title="No students are enrolled in this class yet." />}
        {roster.map((r) => (
          <Card key={r.student_id} onPress={!canMark || s.status === "cancelled" ? undefined : () => setPick(r)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <Avatar name={r.full_name} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{r.full_name}</Text>{r.status === "present" && r.method && HOW[r.method] ? <Text size={12} tone="muted">{HOW[r.method]}</Text> : null}</View>
            {canMark && handOpen && !r.status ? <Button style={{ height: 36, paddingHorizontal: 16 }} onPress={() => requireDoor(() => askPin(r))}>Check in</Button> : <Badge tone={r.status ? tone[r.status] : "muted"}>{r.status ?? "Not yet"}</Badge>}
          </Card>))}
      </Section>

      {isDoor && denied.length > 0 && <Section title="Turned away" aside={<Text size={14} tone="muted" num>{denied.length}</Text>}>
        <Text size={14} tone="muted">{"People who tried the code but aren't cleared for this class."}</Text>
        {denied.map((d) => (
          <Card key={d.student_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <Avatar name={d.full_name} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{d.full_name}</Text><Text size={12} tone="muted">{REASON_LABEL[d.reason] ?? "Not cleared"}{d.attempts > 1 ? ` · ${d.attempts} tries` : ""} · {t(d.last_at)}</Text></View>
            <Badge tone="bad">Red</Badge>
          </Card>))}
      </Section>}

      {canSend && s.status !== "cancelled" && (isTeacher
        ? (chatOpen ? <List><NavRow to={`/messages/${id}`} icon="messages" title="Class channel" hint={sent.length ? `${sent.length} message${sent.length === 1 ? "" : "s"} sent · open chat` : "Message your students"} /></List>
          : <Card><Text size={14} tone="muted">This class{"'"}s channel opens with check-in, at {opensAt(s.start_at)}. After the class ends you can still post to it.</Text></Card>)
        : <Section title="Class channel">
          {chatOpen ? <Composer sessionId={id} onSent={() => { void mq.refetch(); }} /> : <Card><Text size={14} tone="muted">This class{"'"}s channel opens with check-in, at {opensAt(s.start_at)}.</Text></Card>}
          {sent.length > 0 && <View style={{ gap: 8, paddingTop: 8 }}><Text size={14} tone="muted">Sent in this class</Text>{sent.map((m) => <ChatBubble key={m.id} m={m} out at={now} />)}</View>}
        </Section>)}

      {!closed && (isTeacher || isAdmin) && (s.status === "in_progress"
        ? <Button variant="ghost" onPress={openEnd}><Text size={15} weight="medium" tone="bad">End class early</Text></Button>
        : <Button variant="ghost" onPress={cancelClass}><Text size={15} weight="medium" tone="bad">Cancel this class</Text></Button>)}

      <Sheet open={endOpen} onClose={() => setEndOpen(false)} title="End this class early?">
        <View style={{ gap: 16 }}>
          <Text size={14} tone="muted">The class closes now and anyone who hasn{"'"}t checked in is marked absent. Its chat stays open. A reason is needed, and admins can read it.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{END_REASONS.map((r) => <Chip key={r} on={endWhy === r} onPress={() => { setEndWhy(r); setEndErr(""); }}>{r}</Chip>)}</View>
          <Area label={`Reason (${endWhy.length}/300)`} value={endWhy} onChangeText={(v) => { setEndWhy(v); setEndErr(""); }} maxLength={300} rows={3} placeholder="Why is the class ending early?" />
          <Err>{endErr}</Err>
          <View style={{ flexDirection: "row", gap: 8 }}><Button variant="secondary" style={{ flex: 1 }} onPress={() => setEndOpen(false)}>Keep going</Button><Button variant="danger" style={{ flex: 1 }} onPress={endClass}>End class</Button></View>
        </View>
      </Sheet>

      <CodeModal code={shown} open={full && !!shown} onClose={() => setFull(false)} />

      <DoorPinSheet open={gateOpen} onClose={() => { setGateOpen(false); afterUnlock.current = null; if (reveal) router.setParams({ reveal: undefined }); }}
        onUnlocked={() => { setGateOpen(false); const f = afterUnlock.current; afterUnlock.current = null; f?.(); }} />

      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick?.full_name}>
        <View style={{ gap: 8 }}>
          <Text size={14} tone="muted">Set attendance by hand (for example if a phone died). Marking someone present needs the student to enter their own PIN, and only works while check-in is open.</Text>
          {(["present", "absent", "excused"] as const).filter((st) => st !== "present" || (handOpen && pick?.status !== "present")).map((st) => (
            <Button key={st} variant={pick?.status === st ? "primary" : "secondary"}
              onPress={() => { if (st === "present") { const r = pick!; setPick(null); requireDoor(() => askPin(r)); } else void act("Updating attendance…", (sb) => sb.rpc("mark_attendance", { p_session_id: id, p_student_id: pick!.student_id, p_status: st }), () => setPick(null), "Attendance updated"); }}>{st[0].toUpperCase() + st.slice(1)}</Button>))}
        </View>
      </Sheet>

      <Sheet open={!!pinFor} onClose={() => setPinFor(null)} title={pinFor ? `Check in ${pinFor.full_name.split(" ")[0]}` : undefined}>
        {pinFor && (override ? (
          <View style={{ gap: 16 }}>
            <Text size={14} tone="muted">Admin override. {pinFor.full_name.split(" ")[0]} is told right away that you checked them in without their PIN, and can say it wasn{"'"}t them. It{"'"}s recorded with your reason.</Text>
            <Area label={`Reason (${overrideWhy.length}/300)`} value={overrideWhy} onChangeText={(v) => { setOverrideWhy(v); setPinErr(""); }} maxLength={300} rows={3} placeholder="Why can't they enter their PIN?" />
            <Err>{pinErr}</Err>
            <Button disabled={overrideWhy.trim().length < 5} onPress={checkInByHand}>Check in with a reason</Button>
            <Button variant="ghost" onPress={() => { setOverride(false); setPinErr(""); }}>Use their PIN instead</Button>
          </View>
        ) : (
          <View style={{ gap: 20 }}>
            <Text size={14} tone="muted">Hand the phone to {pinFor.full_name.split(" ")[0]}. They type their own 4-digit PIN. {"Don't ask them to say it out loud."}</Text>
            <PinInput value={pinVal} onChange={(v) => { setPinVal(v); setPinErr(""); }} autoFocus invalid={!!pinErr} />
            <Err>{pinErr}</Err>
            <Button disabled={pinVal.length !== PIN_LENGTH} onPress={checkInByHand}>Check in</Button>
            {isAdmin && <Pressable accessibilityRole="button" onPress={() => { setOverride(true); setPinErr(""); }} style={{ minHeight: 44, justifyContent: "center" }}><Text size={14} tone="muted" align="center" style={{ textDecorationLine: "underline" }}>{"Can't enter a PIN? Check in with a reason"}</Text></Pressable>}
          </View>))}
      </Sheet>
    </View>
  );
}
