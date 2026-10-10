// src/features/auth/ResetPassword.tsx
// Port of web src/pages/ResetPassword.tsx @d14323f. Opened from the recovery email link (also the one-time link given to new staff):
// src/app/auth/callback.tsx turns the link into a session, then lands here.
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { updatePassword } from "@/core/authActions";
import { useAuth } from "@/core/auth";
import { rawMessage } from "@/core/errors";
import { isStrong } from "@/shared/web/password";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Card, Err, Heading, Icon, Skeleton, Text, useFeedback } from "@/ui";
import { AppIcon, AuthShell } from "./AuthShell";
import { MatchHint, PasswordCreator, PasswordField } from "./PasswordFields";

export default function ResetPassword() {
  const { p } = useTheme(); const { session, loading } = useAuth(); const router = useRouter(); const { run } = useFeedback();
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const submit = async () => {
    setErr("");
    if (!isStrong(pw)) return setErr("Your password needs to meet every item on the checklist.");
    if (pw !== pw2) return setErr("The two passwords don't match.");
    const r = await run("Updating password…", () => updatePassword(pw), { quiet: true });
    if (!r.ok) { const m = rawMessage(r.error); return setErr(m.includes("different") ? "Choose a password you haven't used before." : m); }
    setDone(true); timer.current = setTimeout(() => router.replace("/"), 1600);
  };

  if (loading) return <AuthShell gap={12}><Skeleton height={40} /><Skeleton height={160} /></AuthShell>;
  if (!session) return (
    <AuthShell gap={16}>
      <Heading size={26} lh={32} align="center">This link has expired</Heading>
      <Text tone="muted" align="center">Reset links work once and only for a short time. Request a new one and try again.</Text>
      <Button onPress={() => router.replace({ pathname: "/login", params: { mode: "forgot" } })}>Back to sign in</Button>
    </AuthShell>
  );
  return (
    <AuthShell>
      <View style={{ alignItems: "center", gap: 4 }}>
        <View style={{ marginBottom: 12 }}><AppIcon size={64} /></View>
        <Heading size={26} lh={32} align="center">Choose a new password</Heading>
        <Text tone="muted" align="center">Follow the checklist to keep your account safe.</Text>
      </View>
      <Card style={{ padding: 20 }}>
        {done ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: p.a("ok", 0.15) }}><Icon name="check" size={28} color={p.c.ok} /></View>
            <Text weight="medium">Password updated</Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <PasswordCreator label="New password" value={pw} onValue={setPw} onGenerate={setPw2} />
            <PasswordField label="Confirm password" value={pw2} onValue={setPw2} autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} />
            <MatchHint a={pw} b={pw2} />
            <Err>{err}</Err>
            <Button onPress={submit} disabled={!isStrong(pw) || pw !== pw2}>Update password</Button>
          </View>
        )}
      </Card>
    </AuthShell>
  );
}
