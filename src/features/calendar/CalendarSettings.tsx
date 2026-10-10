// M11b: the one switch ("Add my classes to my calendar"), ready for M13's Profile to mount: <CalendarSettings />. Asks for calendar access only when it is turned on,
// explains what it does, and on turning off offers to remove what it added. One-way: it never reads the person's other events.
import { useState } from "react";
import { Linking, View } from "react-native";
import { ensurePermission } from "@/native/calendar";
import { fmtWhen } from "@/shared/web/time";
import { Card, Err, SwitchRow, Text, useFeedback } from "@/ui";
import { setCal, useCalState } from "./store";
import { disableCalendar } from "./sync";

export function CalendarSettings() {
  const { confirm } = useFeedback(); const st = useCalState(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const change = async (on: boolean) => {
    setErr(""); setBusy(true);
    try {
      if (on) {
        if (!(await ensurePermission())) { setErr("Calendar access was not allowed. You can turn it on in your phone's settings."); void Linking.openSettings(); return; }
        setCal({ enabled: true }); // the auto-sync hook writes the events as soon as the class list is ready
      } else {
        const remove = await confirm({ title: "Remove your classes from the calendar?", message: "They stop updating either way. You can keep the events already added, or remove them now.", confirmLabel: "Remove them", cancelLabel: "Keep them" });
        await disableCalendar(remove);
      }
    } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 12 }}>
      <SwitchRow title="Add my classes to my calendar" hint="Your upcoming classes appear in a calendar called IQ Academy and stay up to date. It only adds and changes its own events." value={st.enabled} disabled={busy} onChange={change} />
      {st.enabled && <View><Text size={14} tone="muted">{st.lastSyncAt ? `Last updated ${fmtWhen(new Date(st.lastSyncAt).toISOString(), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "Setting up…"}</Text></View>}
      <Err>{err}</Err>
    </Card>
  );
}
