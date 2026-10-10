// src/features/security/SecurityCard.tsx
// Settings for M12, shown on Profile. Changing any switch asks the person to confirm first, so someone holding an unlocked phone cannot quietly switch protection off.
import { useState } from "react";
import { Switch, View } from "react-native";
import { primaryRole, useAuth } from "@/core/auth";
import { authenticate, useCapability } from "@/native/biometrics";
import { useTheme } from "@/theme/ThemeProvider";
import { Card, Chip, ChipRow, Text, useFeedback } from "@/ui";
import { GRACES, type Grace } from "./policy";
import { setSettings, useSecuritySettings } from "./settings";
import { markStrongAuth } from "./stepUp";

function Row({ title, hint, value, onChange, disabled }: { title: string; hint: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { p } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}><Text weight="medium" lh={20}>{title}</Text><Text size={14} tone="muted">{hint}</Text></View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={title} trackColor={{ false: p.c.line, true: p.c.accent }} thumbColor="#fff" />
    </View>
  );
}

export default function SecurityCard() {
  const { roles } = useAuth(); const { toast } = useFeedback(); const s = useSecuritySettings(); const cap = useCapability();
  const [busy, setBusy] = useState(false);
  const isAdmin = ["admin", "super_admin"].includes(primaryRole(roles));
  const noLock = !cap.loading && !cap.enrolled;

  // Every change is confirmed with the phone's own check, so a stranger holding an unlocked phone cannot switch protection off.
  const change = async (patch: Partial<typeof s>, why: string) => {
    if (busy) return; setBusy(true);
    try {
      const r = await authenticate(why);
      if (r.ok) { markStrongAuth(); setSettings(patch); }
      else if (r.reason === "unavailable") toast("Set up a screen lock (PIN, pattern, fingerprint or face) in your phone's settings first.", "bad");
    } finally { setBusy(false); }
  };

  return (
    <Card style={{ gap: 16 }}>
      <View style={{ gap: 2 }}>
        <Text size={16} weight="semibold">Security</Text>
        <Text size={14} tone="muted">{noLock ? "Your phone has no screen lock yet. Set one up in your phone's settings to use these." : `Uses ${cap.label}. Your check-in PIN is separate and works the same as before.`}</Text>
      </View>
      <Row title="Lock the app" hint="Ask when IQ Academy opens or comes back." value={s.appLock} disabled={noLock && !s.appLock} onChange={(v) => change({ appLock: v }, v ? "Turn on the app lock" : "Turn off the app lock")} />
      {s.appLock && (
        <View style={{ gap: 8 }}>
          <Text size={14} weight="medium">Lock</Text>
          <ChipRow>{GRACES.map((g) => <Chip key={g.value} on={s.graceSec === g.value} onPress={() => change({ graceSec: g.value as Grace }, "Change when the app locks")}>{g.label}</Chip>)}</ChipRow>
        </View>
      )}
      {isAdmin && <Row title="Confirm money actions" hint="Ask before approving or declining payments, payouts and refunds." value={s.stepUp} disabled={noLock && !s.stepUp} onChange={(v) => change({ stepUp: v }, v ? "Turn on confirmation for money actions" : "Turn off confirmation for money actions")} />}
    </Card>
  );
}
