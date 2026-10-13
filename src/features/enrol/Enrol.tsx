// Port of web pages/Enrol.tsx @d14323f: pick a pack → pick courses → pick a centre → pay (online with Paystack, or offline with a receipt).
// Differences (intentional): the action bar is pinned by <Screen footer>; Paystack opens in the in-app browser and the result is read from the server (payFlow, ADR-012)
// instead of a 10 s wait; if a payment fails or is still confirming, a retry with the SAME choices reuses the registration it already made (the web would create another).
// Money and eligibility are decided by the database; nothing here prices or approves anything.
import { useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ok } from "@/core/errors";
import { mutateRpc, online, useQuery, useRpc } from "@/data";
import { Screen } from "@/shell/Screen";
import { SoloSheet, useSoloOffers } from "@/features/student/SoloCourses";
import { naira } from "@/shared/format";
import type { MyOffline } from "@/shared/offline";
import { place, placeSub } from "@/shared/web/centre";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Card, Err, Heading, Icon, Skeleton, Text, useFeedback } from "@/ui";
import { canContinue, dueNow, emptySel, feeNote, later, missingFor, selKey, sortCentres, sortInstalments, startsLabel, STEPS, toggleCourse, type Centre, type Course, type Pack, type Pre, type Start } from "./logic";
import type { PayStatus } from "./pay";
import { payInstalment } from "./payFlow";

const CATALOGUE = ["catalogue"]; const TTL = 5 * 60_000;

function Option({ on, onPress, title, sub, note, right, locked, strong, multi }: { on?: boolean; onPress: () => void; title: string; sub?: string | null; note?: string; right?: string; locked?: string; strong?: boolean; multi?: boolean }) {
  const { p } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!!locked} accessibilityRole={multi ? "checkbox" : "radio"} accessibilityState={{ checked: !!on, disabled: !!locked }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, backgroundColor: on ? p.a("accent", 0.1) : p.c.surface, borderWidth: on ? 2 : 1, borderColor: on ? p.c.accent : p.c.line, opacity: locked ? 0.5 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={strong ? 17 : 16} weight={strong ? "semibold" : "medium"} lh={strong ? 23 : 22}>{title}</Text>
        {locked || sub ? <Text size={strong ? 13 : 14} tone="muted" lh={19} style={{ marginTop: 2 }}>{locked ?? sub}</Text> : null}
        {note && !locked ? <Text size={14} weight="medium" tone="accent" style={{ marginTop: 2 }}>{note}</Text> : null}
      </View>
      {right ? <Text weight="medium" num>{right}</Text> : null}
      <View style={{ width: 20, height: 20, borderRadius: multi ? 6 : 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? p.c.accent : "transparent", borderWidth: on ? 0 : 1, borderColor: p.c.line }}>
        {on ? <Icon name="check" size={12} color={p.c.accentInk} /> : null}
      </View>
    </Pressable>
  );
}
const Loading = () => <View style={{ gap: 12 }}><Skeleton height={80} /><Skeleton height={80} /></View>;

export default function Enrol() {
  const { p } = useTheme(); const router = useRouter(); const { run, toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState(emptySel());
  const [method, setMethod] = useState<"online" | "offline">("online");
  const [err, setErr] = useState(""); const [confirming, setConfirming] = useState(false);
  const [soloOpen, setSoloOpen] = useState(false);
  const made = useRef<{ key: string; instalmentId: string } | null>(null);
  const { offers: solo } = useSoloOffers();

  const claimsQ = useRpc<MyOffline[]>("my_offline_payments", {}, { tags: ["payments", "enrolments"], ttlMs: 15_000 });
  const claims = claimsQ.data?.filter((c) => c.enrolment_status === "pending_payment");
  const centresQ = useQuery<Centre[]>({ key: ["enrol", "centres"], tags: CATALOGUE, ttlMs: TTL, fn: async (sb) => (ok(await sb.from("centres").select("id,name,address,city").eq("is_active", true).order("name")) as Centre[]) ?? [] });
  const packsQ = useQuery<Pack[]>({ key: ["enrol", "packs"], tags: CATALOGUE, ttlMs: TTL, fn: async (sb) => (ok(await sb.from("packages").select("id,name,description,course_count,price_full,instalment_fee,package_instalments(number,label,amount,due_rule)").eq("is_active", true).order("sort_order")) as Pack[]) ?? [] });
  const coursesQ = useQuery<Course[]>({ key: ["enrol", "courses"], tags: CATALOGUE, ttlMs: TTL, fn: async (sb) => (ok(await sb.from("courses").select("id,title,summary,sort_order").eq("is_active", true).order("sort_order")) as Course[]) ?? [] });
  const presQ = useQuery<Pre[]>({ key: ["enrol", "pres"], tags: CATALOGUE, ttlMs: TTL, fn: async (sb) => (ok(await sb.from("course_prerequisites").select("course_id,prerequisite_id,group_no")) as Pre[]) ?? [] });
  const doneQ = useQuery<string[]>({ key: ["enrol", "done"], tags: ["enrolments", "progress"], ttlMs: 60_000, fn: async (sb) => ((ok(await sb.from("v_student_progress").select("course_id").eq("course_status", "completed")) as { course_id: string }[]) ?? []).map((x) => x.course_id) });
  const courses = coursesQ.data, pres = presQ.data ?? [], done = useMemo(() => new Set(doneQ.data ?? []), [doneQ.data]);
  const packs = packsQ.data, pack = packs?.find((x) => x.id === sel.pack);
  const title = (id: string) => courses?.find((c) => c.id === id)?.title ?? "";

  // Instructors build each centre's timetable, so the date comes from the first course in the pack.
  const ordered = useMemo(() => (courses ?? []).filter((c) => sel.courses.includes(c.id)), [courses, sel.courses]);
  const first = ordered[0];
  const startsQ = useRpc<Start[]>("centre_course_starts", { p_course_id: first?.id }, { enabled: step === 2 && !!first, tags: ["sessions", "catalogue"], ttlMs: 60_000 });
  const starts = useMemo(() => (startsQ.data ? new Map(startsQ.data.map((x) => [x.centre_id, x.starts_on])) : undefined), [startsQ.data]);

  const inst = useMemo(() => sortInstalments(pack), [pack]);
  const due = dueNow(sel.plan, pack, inst);
  const can = canContinue(step, sel, pack, starts);

  const pay = async () => {
    setErr(""); setConfirming(false);
    const key = selKey(sel, method);
    const r = await run(method === "offline" ? "Saving your registration…" : "Setting up your payment…", async (): Promise<{ offlineId: string | null; status: PayStatus | null }> => {
      let instalmentId = method === "online" && made.current?.key === key ? made.current.instalmentId : null;
      if (!instalmentId) {
        const m = await mutateRpc<string>("create_enrolment", { p_centre_id: sel.centre, p_package_id: sel.pack, p_plan: sel.plan, p_course_ids: sel.courses }, { invalidates: ["enrolments"] });
        if (m.status !== "done") throw new Error("not_online");
        const row = await online(async (sb) => ok(await sb.from("enrolment_instalments").select("id").eq("enrolment_id", m.data).eq("number", 1).single()) as { id: string });
        instalmentId = row.id;
        if (method === "online") made.current = { key, instalmentId };
      }
      if (method === "offline") {
        // Saved as a pending offline payment: nothing leaves the app, the student pays and sends a receipt.
        const o = await mutateRpc<string>("request_offline_payment", { p_instalment_id: instalmentId }, { invalidates: ["payments", "enrolments"] });
        if (o.status !== "done") throw new Error("not_online");
        return { offlineId: o.data, status: null };
      }
      return { offlineId: null, status: await payInstalment(instalmentId) };
    }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    if (r.data.offlineId) return router.replace(`/pay/offline/${r.data.offlineId}` as Href);
    if (r.data.status === "succeeded") { made.current = null; toast("Payment received. Your classes are booked.", "ok"); router.replace("/"); }
    else if (r.data.status === "pending") setConfirming(true);
    else setErr("Payment not completed. No money was taken. You can try again.");
  };

  // A registration is already waiting for an offline payment: finish or cancel that one first.
  if (claims && claims.length > 0) {
    const c = claims[0];
    return (
      <Screen>
        <View style={{ gap: 16 }}>
          <Heading size={26} lh={32}>You have a registration waiting</Heading>
          <Card style={{ gap: 12 }}>
            <Text size={14} tone="muted">{c.package}{c.courses.length ? ` · ${c.courses.join(" + ")}` : ""}</Text>
            <Text size={24} weight="semibold" num>{naira(c.amount)} <Text size={16} tone="muted">offline</Text></Text>
            <Text size={14} tone="muted">{c.receipt ? "Your receipt is with the team, waiting for confirmation." : "Pay and send your receipt, or cancel this registration to start a new one."}</Text>
            <Button onPress={() => router.push(`/pay/offline/${c.id}` as Href)}>Open payment details</Button>
          </Card>
          <Button variant="secondary" onPress={() => router.navigate("/")}>Back home</Button>
        </View>
      </Screen>);
  }

  const footer = (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Button variant="secondary" onPress={() => (step ? setStep(step - 1) : router.navigate("/"))}>Back</Button>
      {step < 3
        ? <Button style={{ flex: 1 }} disabled={!can} onPress={() => setStep(step + 1)}>Continue</Button>
        : <Button style={{ flex: 1 }} disabled={confirming} onPress={pay}>{method === "offline" ? `Continue · pay ${naira(due)} offline` : `Pay ${naira(due)} now`}</Button>}
    </View>);

  const heading = ["Choose your pack", pack ? `Pick ${pack.course_count} courses` : "Pick your courses", "Where will you learn?", "How would you like to pay?"][step];
  return (
    <Screen footer={footer}>
      <View style={{ gap: 20 }}>
        <View>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? p.c.accent : p.c.line }} />)}
          </View>
          <Text size={13} weight="medium" tone="muted">Step {step + 1} of {STEPS.length}</Text>
          <Heading size={26} lh={32} accessibilityRole="header">{heading}</Heading>
        </View>

        <View style={{ gap: 12 }}>
          {step === 0 ? (!packs ? <Loading /> : <>
            {packs.length === 0 ? <Text tone="muted">No course packs are open yet.</Text> : null}
            {packs.map((x) => <Option key={x.id} on={sel.pack === x.id} onPress={() => setSel({ ...sel, pack: x.id, courses: [], centre: "" })} title={x.name} sub={x.description} right={naira(x.price_full)} />)}
            {solo?.length ? (
              <Pressable accessibilityRole="button" onPress={() => setSoloOpen(true)} style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 12 }}>
                <Text size={14} tone="muted">Need just one course? </Text><Text size={14} weight="medium" tone="accent">Explore courses</Text><Icon name="chevronRight" size={16} color={p.c.accent} />
              </Pressable>) : null}
          </>) : null}

          {step === 1 ? (!courses ? <Loading /> : courses.map((c) => {
            const picked = sel.courses.includes(c.id);
            const m = !picked ? missingFor(c, sel.courses, pres, done, title) : null;
            const full = !!pack && sel.courses.length >= pack.course_count && !picked;
            return <Option key={c.id} multi on={picked} onPress={() => setSel({ ...sel, courses: toggleCourse(sel.courses, c, courses, pres, done), centre: "" })} title={c.title} sub={c.summary} locked={m ? `Needs ${m} first` : full ? "Your pack is full" : undefined} />;
          })) : null}

          {step === 2 ? (!centresQ.data || !starts ? <Loading /> : <>
            {first ? <Text size={14} tone="muted">Dates show when <Text size={14} weight="medium">{first.title}</Text>, your first course, starts at each location.</Text> : null}
            {centresQ.data.length ? sortCentres(centresQ.data, starts).map((c) => {
              const d = starts.get(c.id);
              return <Option key={c.id} strong on={sel.centre === c.id} onPress={() => setSel({ ...sel, centre: c.id })} title={place(c)} sub={placeSub(c)} note={d ? startsLabel(d) : undefined} locked={d ? undefined : "No classes scheduled yet"} />;
            }) : <Text tone="muted">No centres are open yet.</Text>}
          </>) : null}

          {step === 3 && pack ? <>
            <Option on={sel.plan === "full"} onPress={() => setSel({ ...sel, plan: "full" })} title="Pay in full" sub="One payment, all set" right={naira(pack.price_full)} />
            {inst.length > 0 ? <Option on={sel.plan === "instalment"} onPress={() => setSel({ ...sel, plan: "instalment" })} title="Pay in instalments" sub={[later(inst), feeNote(pack, naira)].filter(Boolean).join(" · ")} right={naira(inst[0].amount)} /> : null}
            <Text size={14} weight="medium" tone="muted" style={{ paddingTop: 8 }}>How will you pay?</Text>
            <Option on={method === "online"} onPress={() => setMethod("online")} title="Pay online" sub="Card or bank transfer through Paystack. Confirmed straight away." />
            <Option on={method === "offline"} onPress={() => setMethod("offline")} title="Pay offline" sub="Bank transfer. Send your receipt and the team confirms it once the money arrives. Paying cash? Pay at your centre: the coordinator records it and your classes unlock at once." />
            <Card style={{ gap: 4 }}><Text size={14} weight="medium">{pack.name}</Text><Text size={14} tone="muted">{sel.courses.map(title).join(" + ")}</Text></Card>
            <Err>{err}</Err>
            {confirming ? <Card variant="sunken" style={{ gap: 4 }}><Text weight="medium">Still confirming</Text><Text size={14} tone="muted">Your bank is taking a moment. We will update your account as soon as the payment lands. You do not need to pay again.</Text></Card> : null}
          </> : null}
        </View>
      </View>
      <SoloSheet open={soloOpen} onClose={() => setSoloOpen(false)} offers={solo} />
    </Screen>
  );
}
