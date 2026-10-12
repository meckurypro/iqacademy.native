// "The student is at the centre and has paid cash." A coordinator or director records it here in four steps:
//   1. find the student's account (email, name, phone or registration number)   2. what it is for: an unpaid instalment, or a new registration
//   3. count the cash and type the exact amount due                              4. done: the student's classes unlock at once
// The cash is then held by the centre until it is sent to IQ Academy (the Cash screen). Port of web components/RecordCash.tsx @feaca5e. Online-only: it moves money.
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { env } from "@/core/env";
import { friendly, naira } from "@/core/errors";
import { mutateRpc, online } from "@/data";
import { fmtDay, today } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Avatar, Button, Card, Err, Field, Heading, Icon, Sheet, Skeleton, Text, useFeedback } from "@/ui";
import { CASH_TAGS, amountReady, toKobo, type CashDone, type CashOptions, type FoundStudent, type PayableEnrolment } from "./cash";

const APP_URL = env.webBaseUrl ?? "https://classes.promptiq.com.ng";
type Pack = { id: string; name: string; course_count: number; price_full: number; package_instalments: { number: number; label: string; amount: number; due_rule: string }[] };
type Course = { id: string; title: string; sort_order: number };
type Pre = { course_id: string; prerequisite_id: string; group_no: number };
type Target = { kind: "existing"; enrolment: PayableEnrolment } | { kind: "new"; pack: Pack; courseIds: string[]; plan: "full" | "instalment" };

function Row({ on, onPress, title, sub, right, disabled }: { on?: boolean; onPress: () => void; title: string; sub?: string; right?: string; disabled?: boolean }) {
  const { p } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!disabled }} onPress={onPress} disabled={disabled}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, padding: 14, borderRadius: radius["2xl"], backgroundColor: on ? p.a("accent", 0.1) : p.c.surface, borderWidth: on ? 2 : 1, borderColor: on ? p.c.accent : p.c.line, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{title}</Text>{sub ? <Text size={14} tone="muted">{sub}</Text> : null}</View>
      {right ? <Text weight="semibold" num>{right}</Text> : null}
    </Pressable>
  );
}

type Props = { onClose: () => void; centreId: string; centreName: string; onDone: () => void };

/** The sheet shows its content only while open, so the body mounts fresh (empty form) every time it is opened. */
export default function RecordCashSheet(props: Props & { open: boolean }) {
  return <Sheet open={props.open} onClose={props.onClose}><Body onClose={props.onClose} centreId={props.centreId} centreName={props.centreName} onDone={props.onDone} /></Sheet>;
}

function Body({ onClose, centreId, centreName, onDone }: Props) {
  const { p } = useTheme(); const { run, confirm } = useFeedback();
  const [step, setStep] = useState<"find" | "pick" | "new" | "amount" | "done">("find");
  const [q, setQ] = useState(""); const [found, setFound] = useState<FoundStudent[] | null>(null); const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<CashOptions | null>(null); const [student, setStudent] = useState<FoundStudent | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [amount, setAmount] = useState(""); const [note, setNote] = useState(""); const [err, setErr] = useState(""); const [result, setResult] = useState<CashDone | null>(null);
  const [packs, setPacks] = useState<Pack[]>(); const [courses, setCourses] = useState<Course[]>(); const [pres, setPres] = useState<Pre[]>([]);
  const [sel, setSel] = useState({ pack: "", courses: [] as string[], plan: "full" as "full" | "instalment" });
  const [startFor, setStartFor] = useState<{ course: string; on: string | null } | null>(null);

  const reset = () => { setStep("find"); setQ(""); setFound(null); setStudent(null); setOpts(null); setTarget(null); setAmount(""); setNote(""); setErr(""); setResult(null); setSel({ pack: "", courses: [], plan: "full" }); setStartFor(null); };

  const search = async () => {
    setErr(""); setBusy(true);
    try { setFound(await online(async (sb) => { const r = await sb.rpc("cash_find_student", { p_centre_id: centreId, p_query: q }); if (r.error) throw r.error; return (r.data as FoundStudent[]) ?? []; })); }
    catch (e) { setErr(friendly(e)); } finally { setBusy(false); }
  };
  const choose = async (s: FoundStudent) => {
    setErr(""); setStudent(s); setOpts(null); setStep("pick");
    try { setOpts(await online(async (sb) => { const r = await sb.rpc("cash_student_options", { p_centre_id: centreId, p_student_id: s.id }); if (r.error) throw r.error; return r.data as CashOptions; })); }
    catch (e) { setErr(friendly(e)); setStep("find"); }
  };
  const toNew = async () => {
    setStep("new"); setErr("");
    if (packs) return;
    try {
      const all = await online(async (sb) => Promise.all([
        sb.from("packages").select("id,name,course_count,price_full,package_instalments(number,label,amount,due_rule)").eq("is_active", true).order("sort_order"),
        sb.from("courses").select("id,title,sort_order").eq("is_active", true).order("sort_order"),
        sb.from("course_prerequisites").select("course_id,prerequisite_id,group_no"),
      ]));
      setPacks((all[0].data as Pack[]) ?? []); setCourses((all[1].data as Course[]) ?? []); setPres((all[2].data as Pre[]) ?? []);
    } catch (e) { setErr(friendly(e)); }
  };

  const done = useMemo(() => new Set(opts?.completed_course_ids ?? []), [opts]);
  const pack = packs?.find((x) => x.id === sel.pack);
  const title = (id: string) => courses?.find((c) => c.id === id)?.title ?? "";
  // A course is open when every group of prerequisites has one the student finished, or is taking in this same registration.
  const missing = (c: Course, chosen: string[]) => {
    const groups = new Map<number, string[]>();
    pres.filter((x) => x.course_id === c.id).forEach((x) => groups.set(x.group_no, [...(groups.get(x.group_no) ?? []), x.prerequisite_id]));
    for (const ids of groups.values()) if (!ids.some((i) => done.has(i) || chosen.includes(i))) return ids.map(title).join(" or ");
    return null;
  };
  const toggle = (c: Course) => {
    let next = sel.courses.includes(c.id) ? sel.courses.filter((x) => x !== c.id) : [...sel.courses, c.id];
    for (let i = 0; i < 4; i++) next = next.filter((id) => { const k = courses!.find((x) => x.id === id)!; return !missing(k, next.filter((y) => y !== id)); });
    setSel({ ...sel, courses: next });
  };
  const ordered = useMemo(() => (courses ?? []).filter((c) => sel.courses.includes(c.id)), [courses, sel.courses]);
  const first = ordered[0];
  const full = !!pack && sel.courses.length === pack.course_count;
  // When the first course starts at THIS centre (null: no classes yet). Held with the course it was fetched for, so a different choice reads as "still loading".
  useEffect(() => {
    if (!full || !first) return;
    let live = true; const course = first.id;
    online(async (sb) => (await sb.rpc("centre_course_starts", { p_course_id: course })).data as { centre_id: string; starts_on: string }[] | null)
      .then((rows) => { if (live) setStartFor({ course, on: (rows ?? []).find((x) => x.centre_id === centreId)?.starts_on ?? null }); }).catch(() => { if (live) setStartFor({ course, on: null }); });
    return () => { live = false; };
  }, [full, first?.id, centreId]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = full && first && startFor?.course === first.id ? startFor.on : undefined;
  const inst = useMemo(() => [...(pack?.package_instalments ?? [])].sort((a, b) => a.number - b.number), [pack]);

  const due = !target ? 0 : target.kind === "existing" ? target.enrolment.next.amount : target.plan === "full" ? target.pack.price_full : (target.pack.package_instalments.find((i) => i.number === 1)?.amount ?? 0);
  const what = !target ? "" : target.kind === "existing" ? `${target.enrolment.package} · ${target.enrolment.next.label}` : `${target.pack.name} · ${target.plan === "full" ? "Full payment" : "First instalment"}`;
  const kobo = toKobo(amount);

  const record = async () => {
    if (!student || !target) return;
    if (!(await confirm({ title: "Is the cash in your hand?", confirmLabel: `Yes, record ${naira(due)}`, cancelLabel: "Not yet",
      message: `${student.full_name} · ${what}. Their classes unlock straight away. You'll hold this cash for IQ Academy until you send it from the Cash screen.` }))) return;
    setErr("");
    const args: Record<string, unknown> = { p_centre_id: centreId, p_student_id: student.id, p_amount: kobo, p_note: note.trim() || null };
    if (target.kind === "existing") args.p_instalment_id = target.enrolment.next.id;
    else Object.assign(args, { p_package_id: target.pack.id, p_plan: target.plan, p_course_ids: target.courseIds });
    const r = await run("Recording the payment…", async () => { const m = await mutateRpc<CashDone>("cash_record_payment", args, { invalidates: CASH_TAGS }); if (m.status !== "done") throw new Error("not_saved"); return m.data; }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    setResult(r.data); setStep("done"); onDone();
  };
  const back = () => { setErr(""); setStep(step === "amount" ? (target?.kind === "new" ? "new" : "pick") : step === "new" ? "pick" : "find"); };

  return (
    <View style={{ gap: 16 }}>
      <Heading size={20} lh={28}>{step === "done" ? "Payment recorded" : "Record a cash payment"}</Heading>
        {step === "find" && <>
          <Text size={14} tone="muted">Find the student by email, name, phone number or registration number. They need an account first.</Text>
          <Field label="Student" value={q} onChangeText={(v) => { setQ(v); setFound(null); }} onSubmitEditing={() => q.trim().length >= 3 && search()} placeholder="Email, name or phone" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
          <Button disabled={q.trim().length < 3} loading={busy} onPress={search}>Find student</Button>
          {found?.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" onPress={() => choose(s)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, padding: 12, borderRadius: radius["2xl"], backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line }}>
              <Avatar name={s.full_name} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{s.full_name}</Text><Text size={14} tone="muted" numberOfLines={1}>{[s.email, s.phone, s.student_number].filter(Boolean).join(" · ")}</Text></View>
              <Icon name="chevronRight" size={16} color={p.c.muted} />
            </Pressable>))}
          {found && found.length === 0 && (
            <Card style={{ gap: 12 }}>
              <Text weight="medium">No account found</Text>
              <Text size={14} tone="muted">Ask the student to create an account first: have them scan this code (or open {APP_URL}), tap Create account and confirm their email. Then search again here.</Text>
              <View style={{ alignSelf: "center", borderRadius: 12, backgroundColor: "#fff", padding: 8 }}><QRCode value={APP_URL} size={120} backgroundColor="#fff" color="#000" /></View>
            </Card>)}
          <Err>{err}</Err>
        </>}

        {step === "pick" && <>
          {!opts ? <><Skeleton height={56} /><Skeleton height={80} /></> : <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar name={opts.student.full_name} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}><Text weight="semibold" numberOfLines={1}>{opts.student.full_name}</Text><Text size={14} tone="muted" numberOfLines={1}>{[opts.student.email, opts.student.phone, opts.student.student_number].filter(Boolean).join(" · ")}</Text></View>
            </View>
            {opts.enrolments.length > 0 && <View style={{ gap: 8 }}>
              <Text size={14} weight="medium" tone="muted">Unpaid at {centreName}</Text>
              {opts.enrolments.map((e) => (
                <Row key={e.id} title={`${e.package} · ${e.next.label}`} right={naira(e.next.amount)} disabled={!!e.next.claim?.has_receipt}
                  sub={`${e.courses.join(" + ")}${e.next.claim ? (e.next.claim.has_receipt ? " · transfer receipt waiting for an admin" : " · transfer requested, this replaces it") : ""}`}
                  onPress={() => { setTarget({ kind: "existing", enrolment: e }); setAmount(""); setStep("amount"); }} />))}
            </View>}
            <Button variant={opts.enrolments.length ? "secondary" : "primary"} onPress={toNew}>Register them for a new pack</Button>
            {opts.open_transfer && opts.enrolments.length === 0 && <View style={{ borderRadius: radius.xl, backgroundColor: p.a("warn", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="warn">This student has an unpaid registration waiting for a bank transfer elsewhere. Ask them to cancel it from their home screen first.</Text></View>}
          </>}
          <Err>{err}</Err>
          <Button variant="ghost" onPress={back}>Back</Button>
        </>}

        {step === "new" && student && <>
          <Text size={14} tone="muted">New registration for <Text size={14} weight="medium">{student.full_name}</Text> at {centreName}.</Text>
          {!packs || !courses ? <Skeleton height={112} /> : <>
            <View style={{ gap: 8 }}>{packs.map((x) => <Row key={x.id} on={sel.pack === x.id} title={x.name} sub={`${x.course_count} courses`} right={naira(x.price_full)} onPress={() => setSel({ pack: x.id, courses: [], plan: "full" })} />)}</View>
            {pack && <View style={{ gap: 8 }}>
              <Text size={14} weight="medium" tone="muted">Pick {pack.course_count} courses</Text>
              {courses.map((c) => {
                const m = !sel.courses.includes(c.id) ? missing(c, sel.courses) : null; const isFull = sel.courses.length >= pack.course_count && !sel.courses.includes(c.id);
                return <Row key={c.id} on={sel.courses.includes(c.id)} title={c.title} sub={m ? `Needs ${m} first` : isFull ? "The pack is full" : undefined} disabled={!!m || isFull} onPress={() => toggle(c)} />;
              })}
            </View>}
            {pack && full && <View style={{ gap: 8 }}>
              {start === undefined ? <Skeleton height={40} /> : start === null
                ? <View style={{ borderRadius: radius.xl, backgroundColor: p.a("warn", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="warn">No classes are scheduled for {first?.title} at this centre yet, so they can’t register here.</Text></View>
                : <Text size={14} tone="muted">{first?.title} starts {start <= today() ? "today" : fmtDay(start, { day: "numeric", month: "long", year: "numeric" })}.</Text>}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Row on={sel.plan === "full"} title="Pay in full" right={naira(pack.price_full)} onPress={() => setSel({ ...sel, plan: "full" })} /></View>
                <View style={{ flex: 1 }}><Row on={sel.plan === "instalment"} disabled={inst.length === 0} title="Instalments" sub={inst.length ? `${inst.length} payments` : "Not offered"} right={inst[0] ? naira(inst[0].amount) : undefined} onPress={() => setSel({ ...sel, plan: "instalment" })} /></View>
              </View>
              <Button disabled={!start} onPress={() => { setTarget({ kind: "new", pack, courseIds: sel.courses, plan: sel.plan }); setAmount(""); setStep("amount"); }}>Continue</Button>
            </View>}
          </>}
          <Err>{err}</Err>
          <Button variant="ghost" onPress={back}>Back</Button>
        </>}

        {step === "amount" && student && target && <>
          <Card style={{ gap: 4 }}>
            <Text size={14} tone="muted">{student.full_name}</Text><Text size={14} tone="muted">{what}</Text>
            <Text size={30} weight="semibold" num>{naira(due)}</Text><Text size={14} tone="muted">due now</Text>
          </Card>
          <Field label="Cash you counted (₦)" keyboardType="decimal-pad" value={amount} onChangeText={(v) => { setAmount(v.replace(/[^\d.,]/g, "")); setErr(""); }} placeholder="Type the amount" autoFocus />
          {kobo > 0 && kobo !== due && <Text size={14} tone="bad">That isn’t {naira(due)}. Part payments aren’t accepted: collect the exact amount.</Text>}
          <Field label="Note (optional)" value={note} onChangeText={setNote} maxLength={300} placeholder="e.g. paid by the mother" />
          <Err>{err}</Err>
          <Button disabled={!amountReady(amount, due)} onPress={record}>{`Record ${naira(due)} cash`}</Button>
          <Button variant="ghost" onPress={back}>Back</Button>
        </>}

        {step === "done" && result && <View style={{ gap: 16, alignItems: "center", paddingVertical: 8 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: p.a("ok", 0.15) }}><Icon name="check" size={32} color={p.c.ok} /></View>
          <View style={{ alignItems: "center" }}><Text size={18} weight="semibold" align="center">{naira(result.amount)} from {result.student_name}</Text><Text size={14} tone="muted" align="center">{result.instalment_label}</Text></View>
          <View style={{ alignSelf: "stretch", borderRadius: radius.xl, backgroundColor: p.c.sunken, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" }}>
            <Text size={14}>Give them this reference as their receipt</Text><Text size={18} weight="semibold" num selectable>{result.reference}</Text>
          </View>
          <Text size={14} tone="muted" align="center">{result.new_registration ? "They’re registered and their classes are unlocked. " : "Their classes stay unlocked. "}{result.next ? `Next instalment: ${naira(result.next.amount)} (${result.next.label}).` : "Nothing more to pay."} You now hold this cash for IQ Academy.</Text>
          <View style={{ flexDirection: "row", gap: 8 }}><Button variant="secondary" style={{ flex: 1 }} onPress={reset}>Record another</Button><Button style={{ flex: 1 }} onPress={onClose}>Done</Button></View>
        </View>}
    </View>
  );
}
