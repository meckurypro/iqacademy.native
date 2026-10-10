// Port of web components/AssignSheet.tsx. Bottom sheet for giving an instructor one class, "this and later", or a whole course (at one centre or everywhere).
// Previews the outcome and flags double-bookings before anything is saved. Saving is online-only: the server re-checks clashes.
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { mutate } from "@/data";
import { classes, clock, first, label, pick, plan, short, where, type P, type S, type Scope } from "@/shared/web/roster";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Button, Err, Icon, Sheet, Text, useFeedback } from "@/ui";

export default function AssignSheet({ anchor, scope0, ses, people, onClose, onSaved }: { anchor: S; scope0: Scope; ses: S[]; people: P[]; onClose: () => void; onSaved: () => Promise<unknown> | void }) {
  const { p } = useTheme(); const { run, toast } = useFeedback();
  const [scope, setScope] = useState<Scope>(scope0); const [who, setWho] = useState(anchor.instructor_id ?? ""); const [err, setErr] = useState("");

  const counts = useMemo<Record<Scope, number>>(() => ({ class: pick(ses, anchor, "class").length, later: pick(ses, anchor, "later").length, centre: pick(ses, anchor, "centre").length, all: pick(ses, anchor, "all").length }), [ses, anchor]);
  // Hide choices that would do exactly what a neighbouring one does
  const show: Record<Scope, boolean> = { class: true, later: !!anchor.run_id && counts.later > counts.class && counts.later < counts.centre, centre: counts.centre > counts.class, all: counts.all > counts.centre };
  const sc: Scope = show[scope] ? scope : show.centre ? "centre" : "class";
  const opts: { k: Scope; text: string }[] = [{ k: "class", text: "This class" }, { k: "later", text: "This and later" }, { k: "centre", text: `Whole course · ${where(anchor)}` }, { k: "all", text: "Whole course · every centre" }];

  const targets = useMemo(() => pick(ses, anchor, sc), [ses, anchor, sc]);
  const fit = useMemo(() => new Map(people.map((x) => [x.id, plan(ses, x.id, targets)])), [people, ses, targets]);
  const pl = who ? fit.get(who) : undefined; const chosen = people.find((x) => x.id === who);
  const staffed = targets.filter((t) => t.instructor_id).length; const replaced = pl ? pl.ok.filter((t) => t.instructor_id).length : 0;

  const save = async (instr: string | null) => {
    setErr("");
    const body = sc === "class" || sc === "later"
      ? { p_scope: "sessions", p_instructor_id: instr, p_session_ids: targets.map((t) => t.id), p_course_id: null, p_centre_id: null }
      : { p_scope: sc === "centre" ? "course_centre" : "course_all", p_instructor_id: instr, p_session_ids: null, p_course_id: anchor.course_id, p_centre_id: sc === "centre" ? anchor.centre_id : null };
    const r = await run(instr ? "Assigning…" : "Clearing…", async () => {
      const m = await mutate.rpc<{ assigned?: number; clashes?: unknown[] }>("roster_assign", body, { invalidates: ["sessions"] });
      await onSaved(); return m.status === "done" ? m.data : undefined;
    }, { quiet: true });
    if (!r.ok) return setErr(r.message);
    const skipped = r.data?.clashes?.length ?? 0, done = r.data?.assigned ?? 0;
    toast(skipped ? `${done} done, ${skipped} skipped because of a clash` : done === 0 ? "Nothing needed changing" : instr ? `${classes(done)} assigned` : "Instructor cleared", skipped ? "bad" : "ok");
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={anchor.course_title}>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 2 }}>
          <Text size={14} tone="muted">Class {anchor.session_no}{anchor.lesson_title ? ` · ${anchor.lesson_title}` : ""}</Text>
          <Text size={14} tone="muted"><Text size={14} tone="muted" num>{label(anchor.session_date)} · {clock(anchor.start_at)} – {clock(anchor.end_at)}</Text> · {where(anchor)}</Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text size={14} tone="muted">Apply to</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{opts.filter((o) => show[o.k]).map((o) => (
            <Pressable key={o.k} accessibilityRole="radio" accessibilityState={{ selected: sc === o.k }} onPress={() => setScope(o.k)}
              style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: sc === o.k ? p.a("accent", 0.1) : p.c.surface, borderWidth: sc === o.k ? 2 : 1, borderColor: sc === o.k ? p.c.accent : p.c.line }}>
              <Text size={14} weight={sc === o.k ? "medium" : "regular"}>{o.text} <Text size={14} tone="muted" num>{counts[o.k]}</Text></Text></Pressable>))}</View>
        </View>
        <View style={{ gap: 6 }}>
          <Text size={14} tone="muted">Instructor</Text>
          {people.length === 0 ? <Text size={14} tone="muted" style={{ borderRadius: 12, backgroundColor: p.c.sunken, padding: 12 }}>No instructors yet. Promote someone to instructor on the Users page.</Text>
            : <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled contentContainerStyle={{ gap: 8 }}>{people.map((x) => {
              const f = fit.get(x.id)!; const n = targets.length; const dead = f.ok.length === 0 && f.same === 0; const on = who === x.id;
              const hint = f.same === n && n > 0 ? "Already teaching these" : f.clash.length === n && n > 0 ? "Busy at these times" : f.clash.length > 0 ? `Free for ${f.ok.length + f.same}, busy for ${f.clash.length}` : "Free";
              return (
                <Pressable key={x.id} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: dead }} disabled={dead} onPress={() => setWho(x.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 12, opacity: dead ? 0.5 : 1, backgroundColor: on ? p.a("accent", 0.1) : p.c.surface, borderWidth: on ? 2 : 1, borderColor: on ? p.c.accent : p.c.line }}>
                  <Avatar name={x.name} url={x.avatar} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{x.name}</Text><Text size={12} tone={f.clash.length ? "warn" : "muted"}>{hint}</Text></View>
                  <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? p.c.accent : "transparent", borderWidth: on ? 0 : 1, borderColor: p.c.line }}>{on && <Icon name="check" size={12} color={p.c.accentInk} />}</View>
                </Pressable>);
            })}</ScrollView>}
        </View>
        {pl && chosen && (
          <Text size={14} tone="muted">
            {pl.ok.length > 0 ? <><Text size={14} weight="medium">{first(chosen.name)}</Text>{` will teach ${classes(pl.ok.length)}${pl.ok.length > 1 ? ` (${short(pl.ok[0].session_date)} to ${short(pl.ok[pl.ok.length - 1].session_date)})` : ""}.`}</> : "Nothing to change."}
            {pl.same > 0 && pl.ok.length > 0 && ` ${pl.same} already theirs.`}
            {replaced > 0 && ` This replaces ${replaced === 1 ? "the current instructor" : `${replaced} current assignments`}, who will be told.`}
            {pl.clash.length > 0 && ` ${pl.clash.length} skipped: they teach something else at ${pl.clash.length === 1 ? "that time" : "those times"}.`}
          </Text>)}
        <Err>{err}</Err>
        <Button disabled={!pl || pl.ok.length === 0} onPress={() => save(who)}>
          {!who || !pl ? "Choose an instructor" : pl.ok.length === 0 ? (pl.same > 0 ? "Already assigned" : "Can't assign") : `Assign ${first(chosen?.name ?? "")}${pl.ok.length > 1 ? ` to ${pl.ok.length} classes` : ""}`}
        </Button>
        {staffed > 0 && <Button variant="ghost" onPress={() => save(null)}><Text size={15} weight="medium" tone="bad">Clear instructor{staffed > 1 ? ` on ${staffed} classes` : ""}</Text></Button>}
      </View>
    </Sheet>
  );
}
