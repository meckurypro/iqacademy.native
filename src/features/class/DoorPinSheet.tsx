// Port of web components/DoorPinSheet.tsx. Asks an instructor or coordinator for their door PIN before the class code is shown or a student is checked in by hand.
// First time (no PIN yet): they choose one here, then carry on. The PIN is checked on the server (verify_staff_pin: 5 wrong tries pause door tools for 15 minutes); this only collects it.
// Online-only: nothing is unlocked from a cached answer.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/core/auth";
import { friendly } from "@/core/errors";
import { online } from "@/data";
import { PinSetup } from "@/features/student/Pin";
import { Err, Icon, IconTile, PinInput, Sheet, Text, tileIconColor } from "@/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { unlockDoor } from "./doorLock";

const WRONG: Record<string, string> = { pin_incorrect: "That PIN is wrong. Try again.", pin_locked: "Too many wrong PINs. Door tools are paused for 15 minutes." };

function Body({ onUnlocked }: { onUnlocked: () => void }) {
  const { p } = useTheme(); const { session } = useAuth(); const uid = session!.user.id;
  const [has, setHas] = useState<boolean | null>(null); const [pin, setPin] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    online(async (sb) => await sb.rpc("has_staff_pin")).then((r) => { if (!alive) return; if (r.error) setErr(friendly(r.error)); else setHas(r.data === true); }, (e) => { if (alive) setErr(friendly(e)); });
    return () => { alive = false; };
  }, []);

  const done = () => { unlockDoor(uid); onUnlocked(); };
  const check = async (v: string) => {
    if (busy) return; setBusy(true); setErr("");
    try {
      const r = await online(async (sb) => await sb.rpc("verify_staff_pin", { p_pin: v }));
      if (r.error) { setPin(""); return setErr(friendly(r.error)); }
      if (r.data === "ok") return done();
      setPin("");
      if (r.data === "pin_not_set") return setHas(false);
      setErr(WRONG[String(r.data)] ?? "Something went wrong. Please try again.");
    } catch (e) { setPin(""); setErr(friendly(e)); } finally { setBusy(false); }
  };

  if (has === null) return <Text tone="muted" align="center" style={{ paddingVertical: 24 }}>{err || "One moment…"}</Text>;
  return (
    <View style={{ gap: 20 }}>
      <View style={{ alignItems: "center" }}><IconTile size={48}><Icon name="lock" size={24} color={tileIconColor(p, "accent")} /></IconTile></View>
      {has ? <>
        <Text size={14} tone="muted" align="center">Enter your door PIN to continue. It keeps the class code and check-in safe if your phone is left unlocked.</Text>
        <PinInput value={pin} onChange={(v) => { setPin(v); setErr(""); }} autoFocus invalid={!!err} disabled={busy} onComplete={check} />
        <Err>{err}</Err>
      </> : <>
        <Text size={14} tone="muted" align="center">{"Choose a door PIN. You'll type it before showing the class code or checking a student in. It's yours alone: never share it."}</Text>
        <PinSetup staff onDone={done} />
      </>}
    </View>
  );
}

export default function DoorPinSheet({ open, onClose, onUnlocked }: { open: boolean; onClose: () => void; onUnlocked: () => void }) {
  return <Sheet open={open} onClose={onClose} title="Enter your PIN"><Body onUnlocked={onUnlocked} /></Sheet>;
}
