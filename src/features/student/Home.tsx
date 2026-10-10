// src/features/student/Home.tsx
// Port of web src/pages/StudentHome.tsx @d14323f. Renders inside the shell's <Screen> (src/shell/RoleHome.tsx).
import { useCallback, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { naira, ok } from "@/core/errors";
import { mutateRpc, useQuery, useRpc } from "@/data";
import ReviewSheet from "@/features/channels/ReviewSheet";
import type { ReviewTarget } from "@/features/channels/review";
import { payInstalment } from "@/features/enrol/payFlow";
import { checkInDone } from "@/features/student/checkinEvents";
import type { Verdict } from "@/shared/checkin";
import type { MyOffline } from "@/shared/offline";
import { placeLabel } from "@/shared/web/centre";
import { fmtDay, fmtWhen, today } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Badge, Button, Card, Err, Icon, IconTile, Main, PageHeader, Place, Rail, Section, Sheet, Skeleton, Split, Text, useFeedback } from "@/ui";
import CheckInVerdict from "./CheckInVerdict";
import ClassCountdown from "./ClassCountdown";
import CourseOutline from "./CourseOutline";
import CustomClassCard from "./CustomClassCard";
import MakeupCard from "./MakeupCard";
import QrScanner from "./QrScanner";
import SoloCourses from "./SoloCourses";

type Inst = { id: string; number: number; amount: number; status: string; label: string; due_date: string | null };
type Enr = { id: string; status: string; balance: number; total_amount: number; starts_on: string | null; packages: { name: string } | null; enrolment_courses: { sequence_no: number; courses: { title: string } | null }[]; centres: { name: string; city: string | null; address: string | null } | null; enrolment_instalments: Inst[] };
type Ref = { id: string; amount: number; status: string; created_at: string };
type Lesson = { enrolment_id: string; course_id: string; lesson_no: number; title: string; summary: string | null; state: "attended" | "missed" | "upcoming" };
type Prog = { enrolment_id: string; course_id: string; course_title: string; sessions_attended: number; sessions_needed: number; course_status: string };

const ENR_SELECT = "id,status,balance,total_amount,starts_on,packages(name),enrolment_courses(sequence_no,courses(title)),centres(name,city,address),enrolment_instalments(id,number,amount,status,label,due_date)";
const TAGS = ["enrolments", "payments", "attendance", "sessions"];

function Link({ onPress, children, tone = "muted" }: { onPress: () => void; children: string; tone?: "muted" | "accent" }) {
  return <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={{ alignSelf: "center", minHeight: 36, justifyContent: "center" }}><Text size={14} tone={tone} style={{ textDecorationLine: tone === "muted" ? "underline" : "none" }}>{children}</Text></Pressable>;
}

export function StudentHome() {
  const { p } = useTheme(); const router = useRouter(); const { name } = useAuth(); const { run, confirm } = useFeedback();
  const enrQ = useQuery<Enr[]>({ key: ["student-enrolments"], tags: TAGS, ttlMs: 60_000, fn: async (sb) => (ok(await sb.from("enrolments").select(ENR_SELECT).in("status", ["pending_payment", "active", "completed"]).order("created_at", { ascending: false })) as unknown as Enr[]) ?? [] });
  const progQ = useQuery<Prog[]>({ key: ["student-progress"], tags: TAGS, ttlMs: 60_000, fn: async (sb) => (ok(await sb.from("v_student_progress").select("enrolment_id,course_id,course_title,sessions_attended,sessions_needed,course_status").eq("enrolment_status", "active")) as Prog[]) ?? [] });
  const lessonQ = useQuery<Lesson[]>({ key: ["student-lessons"], tags: TAGS, ttlMs: 60_000, fn: async (sb) => (ok(await sb.from("v_lesson_progress").select("enrolment_id,course_id,lesson_no,title,summary,state").eq("enrolment_status", "active").order("lesson_no")) as Lesson[]) ?? [] });
  const refundQ = useQuery<Ref[]>({ key: ["student-refunds"], tags: ["refunds", "payments"], ttlMs: 60_000, fn: async (sb) => (ok(await sb.from("refunds").select("id,amount,status,created_at").order("created_at", { ascending: false }).limit(5)) as Ref[]) ?? [] });
  const claimQ = useRpc<MyOffline[]>("my_offline_payments", {}, { tags: ["payments", "enrolments"], ttlMs: 60_000 });
  const reviewQ = useRpc<ReviewTarget[]>("my_pending_review", {}, { tags: ["attendance", "sessions", "reviews"], ttlMs: 60_000 });
  const reload = useCallback(() => { enrQ.refetch(); progQ.refetch(); lessonQ.refetch(); refundQ.refetch(); claimQ.refetch(); reviewQ.refetch(); }, [enrQ, progQ, lessonQ, refundQ, claimQ, reviewQ]);

  const [openCourse, setOpenCourse] = useState("");
  const [open, setOpen] = useState(false); const [code, setCode] = useState("");
  const [reviewing, setReviewing] = useState<ReviewTarget | null>(null);
  const [scan, setScan] = useState(false); const [err, setErr] = useState(""); const [verdict, setVerdict] = useState<Verdict | null>(null);

  const checkIn = async (c: string = code) => {
    setErr(""); setScan(false);
    const r = await run("Checking you in…", async () => {
      const m = await mutateRpc<Verdict>("check_in", { p_token: c.trim() }, { invalidates: ["attendance", "sessions", "enrolments", "messages", "reviews"] });
      if (m.status !== "done") throw new Error("check_in_queued");
      checkInDone();
      return m.data;
    }, { quiet: true });
    if (!r.ok) return setErr(r.message); // a wrong or expired code stays on the code screen
    setOpen(false); setVerdict(r.data); // otherwise: a full-screen green or red answer
  };
  const pay = async (id: string) => {
    setErr("");
    const r = await run("Opening secure payment…", () => payInstalment(id), { quiet: true });
    if (!r.ok) return setErr(r.message);
    if (r.data === "succeeded") reload();
    else if (r.data === "pending") setErr("We're still confirming your payment. You don't need to pay again; this updates by itself.");
    else setErr("The payment didn't go through. Nothing was charged. Try again.");
  };
  // Switching to Paystack closes the offline request first, so the same instalment can't be paid twice.
  const payOnlineInstead = async (claimId: string, instalmentId: string) => {
    const yes = await confirm({ title: "Pay online instead?", message: "Your offline request will be cancelled and you'll go to secure online payment.", confirmLabel: "Pay online" });
    if (!yes) return;
    setErr("");
    const r = await run("Opening secure payment…", async () => { await mutateRpc("cancel_offline_request", { p_payment_id: claimId }, { invalidates: ["payments"] }); return payInstalment(instalmentId); }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    reload();
  };
  const payOffline = async (instalmentId: string) => {
    setErr("");
    const r = await run("Saving…", async () => { const m = await mutateRpc<string>("request_offline_payment", { p_instalment_id: instalmentId }, { invalidates: ["payments", "enrolments"] }); return m.status === "done" ? m.data : ""; }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    router.push(`/pay/offline/${r.data}`);
  };
  // A saved but unpaid registration can be dropped so the student can pick a different pack, courses or centre.
  // Not offered once a receipt is under review: that money may already be on its way, so the team handles it.
  const cancelReg = async (id: string, hadRequest: boolean) => {
    setErr("");
    const yes = await confirm({ title: "Cancel this registration?", message: `Nothing has been charged.${hadRequest ? " Your offline payment request will be closed too." : ""} Your pack, courses and centre won't be kept, and you can register again whenever you're ready.`, confirmLabel: "Cancel registration", cancelLabel: "Keep it", danger: true });
    if (!yes) return;
    const r = await run("Cancelling…", async () => { await mutateRpc("cancel_enrolment", { p_enrolment_id: id, p_reason: "Cancelled by student" }, { invalidates: ["enrolments", "payments"] }); reload(); }, { success: "Registration cancelled" });
    if (!r.ok) setErr(r.message);
  };
  const closeSheet = () => { setOpen(false); setCode(""); setErr(""); setScan(false); };

  const enr = enrQ.data;
  if (!enr) return <View style={{ gap: 16 }}><Skeleton height={32} style={{ width: "66%" }} /><Skeleton height={160} /><Skeleton height={112} /></View>;
  const prog = progQ.data ?? [], lessons = lessonQ.data ?? [], refunds = refundQ.data ?? [], claims = claimQ.data ?? [], pendingReview = (reviewQ.data ?? [])[0] ?? null;
  const owing = enr.flatMap((e) => e.enrolment_instalments.filter((i) => i.status === "pending").sort((a, b) => a.number - b.number).slice(0, 1).map((i) => ({ e, i })));
  const todayIso = today();
  // Where the student is registered: current registrations first, finished ones only if that is all there is.
  const mine = enr.filter((e) => e.centres && e.status !== "completed"); const here = mine.length ? mine : enr.filter((e) => e.centres);
  const centreLabel = [...new Set(here.map((e) => placeLabel(e.centres!)))].join(", ");
  const first = name.split(" ")[0];

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 12 }}>
        <PageHeader title={`Hi ${first}`} />
        {!!centreLabel && (
          <Pressable accessibilityRole="link" onPress={() => router.push("/profile")} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4 }}>
            <Icon name="pin" size={15} color={p.c.muted} /><Text tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{centreLabel}</Text>
          </Pressable>
        )}
      </View>

      {pendingReview && (
        <Card variant="glass" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconTile tone="accent"><Icon name="star" size={20} solid color={p.c.accent} /></IconTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="medium" lh={20}>How was your last class?</Text>
            <Text size={14} tone="muted" numberOfLines={1}>{[pendingReview.course_title, pendingReview.lesson_title].filter(Boolean).join(" · ")}</Text>
          </View>
          <Button onPress={() => setReviewing(pendingReview)} style={{ height: 36, paddingHorizontal: 16 }}>Rate</Button>
        </Card>
      )}
      <ReviewSheet target={reviewing} onClose={() => setReviewing(null)} onDone={reload} />

      {enr.length === 0 && <CourseOutline />}

      <Split><Rail>
        {enr.filter((e) => e.status === "active" && e.starts_on && e.starts_on > todayIso).map((e) => (
          <Card key={e.id} variant="glass" style={{ gap: 4 }}>
            <Text size={14} weight="medium" tone="info">Your first class</Text>
            <Text size={18} weight="semibold">{fmtDay(e.starts_on!, { weekday: "long", day: "numeric", month: "long" })}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
              <Text size={14} tone="muted">{e.enrolment_courses?.find((c) => c.sequence_no === 1)?.courses?.title}</Text>
              {e.centres && <><Text size={14} tone="muted">{" · "}</Text><Place centre={e.centres} townOnly size={14} tone="muted" /></>}
            </View>
          </Card>
        ))}

        {owing.map(({ e, i }) => {
          const claim = claims.find((c) => c.instalment_id === i.id);
          if (claim) return (
            <Card key={i.id} style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text weight="medium">Offline payment</Text><Badge tone={claim.receipt ? "info" : "warn"}>{claim.receipt ? "Awaiting confirmation" : "Receipt needed"}</Badge>
              </View>
              <Text size={14} tone="muted">{naira(claim.amount)} · {claim.instalment_label ?? "Payment"} · reference <Text size={14} weight="medium" num>{claim.reference}</Text></Text>
              <Text size={14} tone="muted">{claim.receipt ? "The team has your receipt and will confirm once the money arrives. You'll get a notification." : "Pay by cash or transfer, then send your receipt so we can confirm it."}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button style={{ flex: 1 }} onPress={() => router.push(`/pay/offline/${claim.id}`)}>{claim.receipt ? "View details" : "Send receipt"}</Button>
                <Button variant="secondary" style={{ flex: 1 }} onPress={() => payOnlineInstead(claim.id, i.id)}>Pay online</Button>
              </View>
              {e.status === "pending_payment" && !claim.receipt && <Link onPress={() => cancelReg(e.id, true)}>Cancel registration</Link>}
            </Card>
          );
          return (
            <Card key={i.id} style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text weight="semibold">{e.status === "pending_payment" ? "Finish your enrolment" : "Next instalment"}</Text><Text size={18} weight="semibold" num>{naira(i.amount)}</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                <Text size={14} tone="muted">{i.label}</Text>
                {e.centres && <><Text size={14} tone="muted">{" · "}</Text><Place centre={e.centres} townOnly size={14} tone="muted" /></>}
                <Text size={14} tone="muted">{e.status === "pending_payment" && e.starts_on ? ` · classes start ${fmtDay(e.starts_on, { day: "numeric", month: "short" })}` : i.due_date && i.number > 1 ? ` · due ${fmtDay(i.due_date, { day: "numeric", month: "short" })}` : ""}</Text>
              </View>
              {e.status === "pending_payment" && <Text size={14} tone="muted">{[e.packages?.name, [...e.enrolment_courses].sort((a, b) => a.sequence_no - b.sequence_no).map((c) => c.courses?.title).filter(Boolean).join(" + ")].filter(Boolean).join(" · ")}</Text>}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button style={{ flex: 1 }} onPress={() => pay(i.id)}>Pay online</Button>
                <Button variant="secondary" style={{ flex: 1 }} onPress={() => payOffline(i.id)}>Pay offline</Button>
              </View>
              {e.status === "pending_payment" && <Link onPress={() => cancelReg(e.id, false)}>Cancel registration</Link>}
            </Card>
          );
        })}
        <Err>{open ? "" : err}</Err>

        <CustomClassCard onCheckIn={() => setOpen(true)} />
        <ClassCountdown student onCheckIn={() => setOpen(true)} />
      </Rail><Main>
        {prog.length > 0 && (
          <Section title="Your progress">
            {prog.map((pr, k) => {
              const pct = Math.min(100, Math.round((pr.sessions_attended / Math.max(pr.sessions_needed, 1)) * 100));
              const key = `${pr.enrolment_id}:${pr.course_id}`; const list = lessons.filter((l) => l.enrolment_id === pr.enrolment_id && l.course_id === pr.course_id); const isOpen = openCourse === key;
              return (
                <Card key={k} style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <Text weight="medium" style={{ flex: 1 }}>{pr.course_title}</Text><Text size={14} tone="muted" num>{pr.sessions_attended}/{pr.sessions_needed} classes</Text>
                  </View>
                  <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 8, overflow: "hidden", borderRadius: 4, backgroundColor: p.c.sunken }}>
                    <View style={{ height: "100%", borderRadius: 4, width: `${pct}%`, backgroundColor: pct >= 100 ? p.c.ok : p.c.accent }} />
                  </View>
                  {list.length > 0 && <Pressable accessibilityRole="button" onPress={() => setOpenCourse(isOpen ? "" : key)} hitSlop={8} style={{ alignSelf: "flex-start" }}><Text size={14} tone="accent">{isOpen ? "Hide classes" : `See all ${list.length} classes`}</Text></Pressable>}
                  {isOpen && (
                    <View style={{ gap: 8, paddingTop: 4 }}>
                      {list.map((l) => (
                        <View key={l.lesson_no} style={{ flexDirection: "row", gap: 12 }}>
                          <View style={{ marginTop: 2, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: l.state === "attended" ? p.a("ok", 0.15) : l.state === "missed" ? p.a("bad", 0.15) : p.c.sunken }}>
                            {l.state === "attended" ? <Icon name="check" size={14} color={p.c.ok} /> : l.state === "missed" ? <Icon name="close" size={14} color={p.c.bad} /> : <Text size={12} weight="semibold" tone="muted">{l.lesson_no}</Text>}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text size={14} weight="medium" lh={20}>{l.title}{l.state === "missed" ? <Text size={12} tone="bad">{"  Missed"}</Text> : null}</Text>
                            {!!l.summary && <Text size={14} tone="muted">{l.summary}</Text>}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              );
            })}
          </Section>
        )}

        <MakeupCard />
        {enr.length > 0 && <SoloCourses />}

        {refunds.length > 0 && (
          <Section title="Refunds">
            {refunds.map((r) => (
              <Card key={r.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 }}>
                <View><Text weight="medium" num>{naira(r.amount)}</Text><Text size={14} tone="muted">{fmtWhen(r.created_at, { dateStyle: "short" })}</Text></View>
                <Badge tone={r.status === "paid" ? "ok" : "info"}>{r.status === "paid" ? "Sent" : "On its way"}</Badge>
              </Card>
            ))}
          </Section>
        )}
      </Main></Split>

      <Sheet open={open} onClose={closeSheet} title="Enter your class code">
        <View style={{ gap: 16 }}>
          {scan
            ? <QrScanner onCode={(c) => { setCode(c.toUpperCase()); checkIn(c.toUpperCase()); }} onClose={() => setScan(false)} />
            : <Button variant="secondary" icon="scan" onPress={() => setScan(true)}>Scan the QR code</Button>}
          <Text size={14} tone="muted">Or type the 8-character code shown at the centre.</Text>
          <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} maxLength={8} placeholder="A1B2C3D4" accessibilityLabel="Class code" autoCapitalize="characters" autoCorrect={false} autoComplete="off"
            placeholderTextColor={p.a("muted", 0.4)} selectionColor={p.c.accent} returnKeyType="go" onSubmitEditing={() => { if (code.length >= 8) checkIn(); }}
            style={{ height: 56, borderRadius: radius.xl, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, textAlign: "center", fontFamily: "Geist-SemiBold", fontSize: 24, letterSpacing: 7.2, color: p.c.ink, padding: 0 }} />
          <Err>{err}</Err>
          <Button disabled={code.length < 8} onPress={() => checkIn()}>Check in</Button>
        </View>
      </Sheet>
      {verdict && <CheckInVerdict v={verdict} onDone={() => { setVerdict(null); setCode(""); }} onRetry={() => { setVerdict(null); setCode(""); setOpen(true); }} />}
    </View>
  );
}
