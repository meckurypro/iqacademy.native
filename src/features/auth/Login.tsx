// src/features/auth/Login.tsx
// Port of web src/pages/Login.tsx @d14323f: sign in, create account, forgot password. Same copy, same flow.
// Route params replace the web's router state:  /login?mode=in|up|forgot&email=…
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { sendResetLink, signInWithPassword, signUpWithPassword } from "@/core/authActions";
import { setPending } from "@/shared/verify";
import { isStrong } from "@/shared/web/password";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Card, Err, Field, Heading, Icon, Text, useFeedback } from "@/ui";
import { AppIcon, AuthShell } from "./AuthShell";
import { PasswordCreator, PasswordField } from "./PasswordFields";

type Mode = "in" | "up" | "forgot";
const TITLE: Record<Mode, string> = { in: "Welcome back", up: "Join IQ Academy", forgot: "Reset your password" };
const CTA: Record<Mode, string> = { in: "Sign in", up: "Create account", forgot: "Send reset link" };

export default function Login() {
  const { p } = useTheme(); const router = useRouter(); const { run } = useFeedback();
  const st = useLocalSearchParams<{ mode?: string; email?: string }>();
  const [mode, setMode] = useState<Mode>(st.mode === "up" || st.mode === "forgot" ? st.mode : "in");
  const [f, setF] = useState({ name: "", email: st.email ?? "", password: "" });
  const [err, setErr] = useState(""); const [note, setNote] = useState("");
  const go = (m: Mode) => { setMode(m); setErr(""); setNote(""); };

  const submit = async () => {
    setErr(""); setNote("");
    const email = f.email.trim();
    if (!email) return setErr("Enter your email address.");
    if (mode === "up" && !isStrong(f.password)) return setErr("Your password needs to meet every item on the checklist.");
    if (mode === "forgot") {
      await run("Sending reset link…", () => sendResetLink(email), { quiet: true });
      // Same message whether or not the account exists, so nobody can probe for registered emails.
      return setNote("If there's an account for that email, we've sent a link to reset your password. Check your inbox (and spam).");
    }
    const r = await run(mode === "in" ? "Signing in…" : "Creating your account…",
      () => (mode === "in" ? signInWithPassword(email, f.password) : signUpWithPassword(email, f.password, f.name.trim())), { quiet: true });
    if (!r.ok) return setErr(r.message);
    const { data, error } = r.data;
    if (error) {
      if (/not confirmed/i.test(error.message)) { setPending(email); return router.push({ pathname: "/verify-email", params: { email } }); }
      return setErr(/Invalid login/i.test(error.message) ? "Wrong email or password." : error.message);
    }
    // Signed in: the root gate swaps this screen for the app. Signed up without a session: the address still needs confirming.
    if (mode === "up" && !data.session) { setPending(email); router.push({ pathname: "/verify-email", params: { email } }); }
  };

  return (
    <AuthShell>
      <View style={{ alignItems: "center", gap: 4 }}>
        <View style={{ marginBottom: 12 }}><AppIcon size={56} /></View>
        <Heading size={26} lh={32} align="center" accessibilityRole="header">{TITLE[mode]}</Heading>
        <Text tone="muted" align="center">{mode === "forgot" ? "We'll email you a link to choose a new one." : "Understand. Design. Build. Automate."}</Text>
      </View>
      <Card style={{ gap: 16, padding: 24 }} variant="surface">
        {mode === "up" && <Field label="Full name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} autoComplete="name" textContentType="name" autoCapitalize="words" returnKeyType="next" />}
        <Field label="Email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} returnKeyType={mode === "forgot" ? "send" : "next"} onSubmitEditing={mode === "forgot" ? submit : undefined} />
        {mode === "in" && <PasswordField label="Password" value={f.password} onValue={(v) => setF({ ...f, password: v })} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />}
        {mode === "up" && <PasswordCreator label="Password" value={f.password} onValue={(v) => setF({ ...f, password: v })} />}
        {mode === "in" && (
          <Pressable accessibilityRole="link" onPress={() => go("forgot")} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: -4, minHeight: 32, justifyContent: "center" }}>
            <Text size={14} tone="accent">Forgot password?</Text>
          </Pressable>
        )}
        <Err>{err}</Err>
        {!!note && <View accessibilityLiveRegion="polite" style={{ borderRadius: 12, backgroundColor: p.a("ok", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="ok">{note}</Text></View>}
        <Button onPress={submit} disabled={mode === "up" && !isStrong(f.password)}>{CTA[mode]}</Button>
      </Card>
      <Pressable accessibilityRole="button" onPress={() => go(mode === "in" ? "up" : "in")} style={{ alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
        {mode === "forgot"
          ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="arrowLeft" size={16} color={p.c.muted} /><Text size={14} tone="muted">Back to sign in</Text></View>
          : <Text size={14} tone="muted">{mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}</Text>}
      </Pressable>
    </AuthShell>
  );
}
