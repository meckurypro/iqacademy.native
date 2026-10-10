// A student's review of a class that has ended: stars, an honest comment, and (only if something went wrong) a report about the instructor.
// One review per student per class. Admins read it; the instructor does not see it. Needs a connection.
import { useState } from "react";
import { Switch, TextInput, View } from "react-native";
import { mutate } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Err, Sheet, StarPicker, Text, useFeedback } from "@/ui";
import { MAX_COMMENT, MAX_WHY, reviewArgs, validateReview, type ReviewTarget } from "./review";

function Form({ target, onClose, onDone }: { target: ReviewTarget; onClose: () => void; onDone?: () => void }) {
  const { p } = useTheme(); const { run } = useFeedback();
  const [rating, setRating] = useState(0); const [comment, setComment] = useState("");
  const [report, setReport] = useState(false); const [why, setWhy] = useState(""); const [err, setErr] = useState("");
  const who = target.instructor_first_name ? `Instructor ${target.instructor_first_name}` : "your instructor";
  const box = { borderRadius: 14, padding: 12, fontSize: 15, lineHeight: 21, color: p.c.ink, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, textAlignVertical: "top" as const };

  const submit = async () => {
    const input = { rating, comment, report, why };
    const problem = validateReview(input); if (problem) return setErr(problem); setErr("");
    const r = await run("Sending your review…", () => mutate.rpc("submit_class_review", reviewArgs(target.session_id, input), { invalidates: ["messages"] }), { success: "Thank you for your review", quiet: true });
    if (!r.ok) return setErr(r.message);
    onDone?.(); onClose();
  };
  return (
    <View style={{ gap: 20 }}>
      <Text size={14} tone="muted">{[target.course_title, target.lesson_title].filter(Boolean).join(" · ")}</Text>
      <StarPicker value={rating} onChange={(n) => { setRating(n); setErr(""); }} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}><Text size={14} weight="medium">Your honest review</Text><Text size={12} tone="muted" num>{`${comment.length}/${MAX_COMMENT}`}</Text></View>
        <TextInput value={comment} onChangeText={setComment} multiline maxLength={MAX_COMMENT} numberOfLines={4} accessibilityLabel="Your honest review" placeholder="What worked, what didn't, how the class went. Good or bad, we want to hear it." placeholderTextColor={p.c.muted} style={{ ...box, minHeight: 104 }} />
      </View>
      <View style={{ borderRadius: 18, padding: 14, gap: 12, backgroundColor: report ? p.a("bad", 0.06) : p.c.sunken, borderWidth: 1, borderColor: report ? p.a("bad", 0.3) : "transparent" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}><Text weight="medium">{`Report ${who}`}</Text><Text size={12} tone="muted">Only if something was wrong, like rudeness, no-shows or unfair treatment.</Text></View>
          <Switch value={report} onValueChange={setReport} accessibilityLabel={`Report ${who}`} trackColor={{ false: p.c.line, true: p.c.bad }} />
        </View>
        {report ? (
          <View style={{ gap: 6 }}>
            <Text size={14} weight="medium">What happened?</Text>
            <TextInput value={why} onChangeText={setWhy} multiline maxLength={MAX_WHY} numberOfLines={3} accessibilityLabel="What happened" placeholder="Describe it in your own words." placeholderTextColor={p.c.muted} style={{ ...box, minHeight: 80 }} />
            <Text size={12} tone="muted">Only the admins read this. It is never shown on the website.</Text>
          </View>) : null}
      </View>
      <Err>{err}</Err>
      <Button disabled={!rating} onPress={submit}>Send review</Button>
      <Text size={12} tone="muted" align="center">{"Your instructor doesn't see your review. If an admin picks it for our website, your name, photo and review will be shown there."}</Text>
    </View>
  );
}

export default function ReviewSheet({ target, onClose, onDone }: { target: ReviewTarget | null; onClose: () => void; onDone?: () => void }) {
  return <Sheet open={!!target} onClose={onClose} title="How was this class?">{target ? <Form key={target.session_id} target={target} onClose={onClose} onDone={onDone} /> : null}</Sheet>;
}
