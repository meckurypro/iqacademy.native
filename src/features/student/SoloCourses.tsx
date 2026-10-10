// Port of web components/SoloCourses.tsx. Anyone can look at the single courses; only a student who has already paid for a course pack can register for one
// (the database enforces it in create_solo_enrolment; the sheet says so politely before they go further). Prices come from the database, never from here.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { friendly, ok } from "@/core/errors";
import { mutateRpc, online, useRpc } from "@/data";
import { payInstalment } from "@/features/enrol/payFlow";
import { naira } from "@/shared/format";
import { place } from "@/shared/web/centre";
import { fmtDay, today } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Button, Card, Err, Icon, Place, Sheet, Skeleton, Text, useFeedback } from "@/ui";

export type Offer = { course_id: string; title: string; summary: string | null; price: number | null; prereq_met: boolean; has_prereq: boolean; taken: boolean; needs: string | null; blocked: string | null };
type Centre = { id: string; name: string; city: string | null; address: string | null };
type Start = { centre_id: string; starts_on: string };

const startsLabel = (iso: string) => (iso <= today() ? "Starts today" : `Starts ${fmtDay(iso, { day: "numeric", month: "long", year: "numeric" })}`);

/** Courses a student can buy on their own. Courses without a price are left out; undefined while loading. Works from the saved copy when offline. */
export function useSoloOffers() {
  const q = useRpc<Offer[]>("solo_course_offers", {}, { tags: ["enrolments", "courses"], ttlMs: 5 * 60_000 });
  return { offers: q.data ? q.data.filter((o) => o.blocked !== "price_not_set") : undefined, reload: q.refetch, offline: q.offline };
}

export function SoloSheet({ open, onClose, offers }: { open: boolean; onClose: () => void; offers?: Offer[] }) {
  const { p } = useTheme(); const { run, toast } = useFeedback(); const router = useRouter();
  const [needPack, setNeedPack] = useState(false);
  const [pick, setPick] = useState<Offer | null>(null);
  const [centres, setCentres] = useState<Centre[]>();
  const [starts, setStarts] = useState<Map<string, string>>(new Map());
  const [centre, setCentre] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false);

  const close = () => { setPick(null); setCentre(""); setErr(""); setNeedPack(false); setPending(false); onClose(); }; // start fresh next time it opens

  const choose = async (o: Offer) => {
    setNeedPack(false); setErr("");
    try {
      // Going on to register needs a paid course pack. Checked fresh each time; the database checks again at payment.
      const can = await online(async (sb) => (await sb.rpc("can_buy_solo")).data as boolean | null);
      if (can === false) { setNeedPack(true); return; }
      setPick(o); setCentre(""); setCentres(undefined);
      const [c, s] = await online(async (sb) => Promise.all([
        sb.from("centres").select("id,name,city,address").eq("is_active", true),
        sb.rpc("centre_course_starts", { p_course_id: o.course_id }),
      ]));
      const map = new Map(((s.data as Start[]) ?? []).map((x) => [x.centre_id, x.starts_on]));
      setStarts(map);
      setCentres(((c.data as Centre[]) ?? []).sort((a, b) => (map.get(a.id) ?? "9").localeCompare(map.get(b.id) ?? "9") || place(a).localeCompare(place(b))));
    } catch (e) { setPick(null); setErr(friendly(e)); }
  };

  const pay = async () => {
    if (!pick || !centre) return;
    setErr(""); setPending(false);
    const r = await run("Setting up your payment…", async () => {
      const made = await mutateRpc<string>("create_solo_enrolment", { p_centre_id: centre, p_course_id: pick.course_id }, { invalidates: ["enrolments"] });
      if (made.status !== "done") throw new Error("not_online");
      const inst = await online(async (sb) => ok(await sb.from("enrolment_instalments").select("id").eq("enrolment_id", made.data).eq("number", 1).single()) as { id: string });
      return payInstalment(inst.id);
    }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    if (r.data === "succeeded") { toast("Payment received. Your course is booked.", "ok"); close(); }
    else if (r.data === "pending") setPending(true);
    else setErr("Payment not completed. No money was taken. You can try again.");
  };

  return (
    <Sheet open={open} onClose={close} title={pick ? undefined : "Single courses"}>
      {!pick ? (
        <View style={{ gap: 10 }}>
          {!offers ? <><Skeleton height={80} /><Skeleton height={80} /></> : offers.map((o) => {
            const busy = o.blocked === "in_progress";
            return (
              <Pressable key={o.course_id} disabled={busy} onPress={() => choose(o)} accessibilityRole="button" accessibilityState={{ disabled: busy }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16, borderRadius: 20, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <Text weight="medium" style={{ flexShrink: 1 }}>{o.title}</Text>
                    {o.taken && !busy && <Badge tone="accent">Retake</Badge>}
                    {busy && <Badge tone="muted">In progress</Badge>}
                  </View>
                  {o.summary ? <Text size={14} tone="muted" numberOfLines={2}>{o.summary}</Text> : null}
                  {o.needs && !busy ? <Text size={13} tone="muted">Builds on <Text size={13} weight="medium">{o.needs}</Text></Text> : null}
                </View>
                {o.price != null && !busy ? <Text size={17} weight="semibold" num>{naira(o.price)}</Text> : null}
              </Pressable>);
          })}
          {needPack && (
            <Card variant="sunken" style={{ gap: 8 }}>
              <Text weight="medium">Single courses come after a course pack</Text>
              <Text size={14} tone="muted">To keep things fair and the learning path in order, single courses are open once you have registered and paid for a course pack (2 courses over 6 weeks, or 3 courses over 10 weeks). After that you can add any single course.</Text>
              <Button variant="secondary" style={{ height: 40 }} onPress={() => { close(); router.navigate("/enrol"); }}>See course packs</Button>
            </Card>)}
          <Err>{err}</Err>
          {offers && !offers.length ? <Text tone="muted" align="center" style={{ paddingVertical: 24 }}>No single courses are open yet.</Text> : null}
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Pressable onPress={() => setPick(null)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="arrowLeft" size={16} color={p.c.muted} /><Text size={14} tone="muted">Courses</Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <View style={{ flex: 1, gap: 4 }}><Text size={18} weight="medium">{pick.title}</Text>{pick.taken ? <View style={{ alignSelf: "flex-start" }}><Badge tone="accent">Retake</Badge></View> : null}</View>
              {pick.price != null ? <Text size={18} weight="semibold" num>{naira(pick.price)}</Text> : null}
            </View>
          </View>
          <Text size={14} weight="medium" tone="muted">Where will you learn?</Text>
          <View style={{ gap: 10 }}>
            {!centres ? <Skeleton height={80} /> : centres.map((c) => {
              const d = starts.get(c.id), on = centre === c.id;
              return (
                <Pressable key={c.id} disabled={!d} onPress={() => setCentre(c.id)} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !d }}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, backgroundColor: on ? p.a("accent", 0.1) : p.c.surface, borderWidth: on ? 2 : 1, borderColor: on ? p.c.accent : p.c.line, opacity: d ? 1 : 0.5, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Place centre={c} size={17} />
                    <Text size={14} weight={d ? "medium" : "regular"} tone={d ? "accent" : "muted"}>{d ? startsLabel(d) : "No classes scheduled yet"}</Text>
                  </View>
                  <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? p.c.accent : "transparent", borderWidth: on ? 0 : 1, borderColor: p.c.line }}>
                    {on ? <Icon name="check" size={12} color={p.c.accentInk} /> : null}
                  </View>
                </Pressable>);
            })}
          </View>
          <Err>{err}</Err>
          {pending ? <Card variant="sunken"><Text weight="medium">Still confirming</Text><Text size={14} tone="muted">Your bank is taking a moment. We will update your account as soon as the payment lands. You do not need to pay again.</Text></Card> : null}
          <Button disabled={!centre || pending} onPress={pay}>{`Pay ${pick.price != null ? naira(pick.price) : ""}`.trim()}</Button>
        </View>)}
    </Sheet>
  );
}

// Student home: a quiet card for students who already have an enrolment.
export default function SoloCourses() {
  const { offers } = useSoloOffers();
  const [open, setOpen] = useState(false);
  if (!offers?.length) return null;
  return (
    <>
      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}><Text weight="medium">Want more?</Text><Text size={14} tone="muted">Buy a single course, or take one again.</Text></View>
        <Button variant="secondary" style={{ height: 40 }} onPress={() => setOpen(true)}>Buy a course</Button>
      </Card>
      <SoloSheet open={open} onClose={() => setOpen(false)} offers={offers} />
    </>
  );
}
