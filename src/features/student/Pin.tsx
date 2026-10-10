// src/features/student/Pin.tsx
// Port of web components/PinInput.tsx (PinSetup, ChangePinForm) and components/PinGate.tsx. The keypad itself is src/ui/PinInput (M2).
// PinSetup and ChangePinForm take `staff`: the same screens for the door PIN that instructors and coordinators use (migration 55); M9a and M13 reuse them.
import { useEffect, useRef, useState } from "react";
import { AppState, Modal, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mutateRpc, signOutAndWipe, useRpc } from "@/data";
import { PasswordField } from "@/features/auth/PasswordFields";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Err, Heading, Icon, IconTile, PIN_LENGTH, PinInput, Text, tileIconColor, useFeedback } from "@/ui";

/** First-time PIN: choose it, type it again, then save. */
export function PinSetup({ onDone, staff }: { onDone: () => void; staff?: boolean }) {
  const { run } = useFeedback();
  const [first, setFirst] = useState(""); const [again, setAgain] = useState(""); const [step, setStep] = useState<"choose" | "confirm">("choose"); const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const back = (msg = "") => { setFirst(""); setAgain(""); setStep("choose"); setErr(msg); };
  const save = async () => {
    if (again !== first) return back("Those two PINs don't match. Let's start again.");
    const r = await run("Saving your PIN…", () => mutateRpc(staff ? "set_staff_pin" : "set_pin", { p_pin: first }, { invalidates: ["pin"] }), { success: "PIN saved", quiet: true });
    if (!r.ok) return setErr(r.message);
    onDone();
  };
  return (
    <View style={{ gap: 20 }}>
      {step === "choose"
        ? <PinInput key="a" value={first} onChange={(v) => { setFirst(v); setErr(""); }} label="Choose a 4-digit PIN" autoFocus onComplete={() => { timer.current = setTimeout(() => setStep("confirm"), 180); }} />
        : <PinInput key="b" value={again} onChange={(v) => { setAgain(v); setErr(""); }} label="Type it again to confirm" autoFocus invalid={!!err}
            onComplete={(v) => { if (v !== first) back("Those two PINs don't match. Let's start again."); }} />}
      <Err>{err}</Err>
      {step === "confirm" && (
        <View style={{ gap: 8 }}>
          <Button disabled={again.length !== PIN_LENGTH} onPress={save}>Save PIN</Button>
          <Button variant="ghost" onPress={() => back()}>Start again</Button>
        </View>
      )}
    </View>
  );
}

/** Change an existing PIN. The server checks the password, so this can't be done from a phone that was just left unlocked. */
export function ChangePinForm({ onDone, staff }: { onDone: () => void; staff?: boolean }) {
  const { p } = useTheme(); const { run } = useFeedback();
  const [pin, setPin] = useState(""); const [pin2, setPin2] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState("");
  const submit = async () => {
    if (pin.length !== PIN_LENGTH) return setErr("A PIN is exactly 4 digits.");
    if (pin !== pin2) return setErr("The two new PINs don't match.");
    if (!pw) return setErr("Enter your password.");
    if (pw !== pw2) return setErr("The two passwords don't match.");
    setErr("");
    const r = await run("Changing your PIN…", async () => {
      const m = await mutateRpc<string>(staff ? "change_staff_pin" : "change_pin", { p_new_pin: pin, p_password: pw, p_password_confirm: pw2 }, { invalidates: ["pin"] });
      if (m.status === "done" && m.data !== "ok") throw new Error(String(m.data));
    }, { success: "PIN changed", quiet: true });
    if (!r.ok) { setPw(""); setPw2(""); return setErr(r.message); }
    onDone();
  };
  return (
    <View style={{ gap: 20 }}>
      <PinInput value={pin} onChange={(v) => { setPin(v); setErr(""); }} label="New 4-digit PIN" />
      <PinInput value={pin2} onChange={(v) => { setPin2(v); setErr(""); }} label="Type the new PIN again" invalid={pin2.length === PIN_LENGTH && pin2 !== pin} />
      <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: p.c.line, paddingTop: 16 }}>
        <Text size={14} tone="muted">{"To make sure it's you, type your account password twice."}</Text>
        <PasswordField label="Password" value={pw} onValue={(v) => { setPw(v); setErr(""); }} autoComplete="current-password" textContentType="password" />
        <PasswordField label="Password again" value={pw2} onValue={(v) => { setPw2(v); setErr(""); }} autoComplete="current-password" textContentType="password" />
      </View>
      <Err>{err}</Err>
      <Button disabled={pin.length !== PIN_LENGTH || pin2.length !== PIN_LENGTH || !pw || !pw2} onPress={submit}>Change PIN</Button>
    </View>
  );
}

/**
 * After a student's first successful payment they must choose a check-in PIN before they can use the app. The server says when (pin_required):
 * a student who has paid and has no PIN. The gate covers the whole app until the PIN is saved. Asked when the app opens and whenever it returns to the
 * foreground (a payment may have just gone through).
 */
export function PinGate() {
  const { p } = useTheme(); const insets = useSafeAreaInsets(); const { confirm } = useFeedback();
  const q = useRpc<boolean>("pin_required", {}, { tags: ["pin", "payments", "enrolments"], ttlMs: 15_000 });
  const [done, setDone] = useState(false);
  const { refetch } = q;
  useEffect(() => { const s = AppState.addEventListener("change", (st) => { if (st === "active") refetch(); }); return () => s.remove(); }, [refetch]);
  const required = q.data === true && !done;
  return (
    <Modal visible={required} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View accessibilityViewIsModal accessibilityLabel="Set your check-in PIN" style={{ flex: 1, backgroundColor: p.c.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40, paddingHorizontal: 24 }}>
          <View style={{ width: "100%", maxWidth: 384, alignSelf: "center", gap: 24 }}>
            <View style={{ alignItems: "center", gap: 12 }}>
              <IconTile size={56}><Icon name="lock" size={26} color={tileIconColor(p, "muted")} /></IconTile>
              <Heading size={26} lh={32} align="center" accessibilityRole="header">Set your check-in PIN</Heading>
              <Text tone="muted" align="center" lh={24}>{"Thanks for your payment. One last step. If you can't scan the class code, the person at the door will ask you to type this PIN on their phone, so nobody can check you in without you."}</Text>
            </View>
            <PinSetup onDone={() => setDone(true)} />
            <Text size={12} tone="muted" align="center">{"Never tell your PIN to anyone, and type it yourself. You'll be notified every time someone checks you in."}</Text>
            <Button variant="ghost" onPress={() => { signOutAndWipe(confirm).catch(() => {}); }}>Sign out</Button>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
