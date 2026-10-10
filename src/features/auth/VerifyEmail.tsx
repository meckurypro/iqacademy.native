// src/features/auth/VerifyEmail.tsx
// Port of web src/pages/VerifyEmail.tsx @d14323f. Three states: signed in (the link worked), no address known, waiting for the click (or the link expired).
// Route params replace the web's router state:  /verify-email?email=…&expired=1
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { resendSignupEmail } from "@/core/authActions";
import { useAuth } from "@/core/auth";
import { kv } from "@/core/kv";
import { clearPending, getPending, inboxLink, setPending } from "@/shared/verify";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Card, Err, Field, Heading, Icon, Text, useFeedback } from "@/ui";
import { AppIcon, AuthShell } from "./AuthShell";

const COOLDOWN = 60;
const cdKey = (e: string) => `iq:resend-at:${e}`;
const remaining = (email: string) => Math.max(0, COOLDOWN - Math.floor((Date.now() - Number(kv.get(cdKey(email)) || 0)) / 1000));

function Badge({ tone, icon }: { tone: "ok" | "warn" | "accent"; icon: "check" | "mail" }) {
  const { p } = useTheme();
  return (
    <View style={{ alignSelf: "center", width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: p.a(tone, 0.15) }}>
      <Icon name={icon} size={icon === "check" ? 32 : 30} color={p.c[tone]} />
    </View>
  );
}

export default function VerifyEmail() {
  const { p } = useTheme(); const { session, name } = useAuth(); const router = useRouter(); const { run } = useFeedback();
  const st = useLocalSearchParams<{ email?: string; expired?: string }>();
  const [email, setEmail] = useState(() => (st.email || getPending()?.email || "").toLowerCase());
  const [typed, setTyped] = useState("");
  const expired = st.expired === "1";
  const [left, setLeft] = useState(() => (email ? remaining(email) : 0));
  const [err, setErr] = useState(""); const [sent, setSent] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(email ? remaining(email) : 0), 1000);
    return () => clearTimeout(t);
  }, [left, email]);

  const resend = useCallback(async (to: string) => {
    setErr(""); setSent(false);
    const r = await run("Sending email…", () => resendSignupEmail(to), { quiet: true });
    if (!r.ok) return setErr(r.message);
    const { error } = r.data;
    if (error) {
      if (/second|rate|limit|too many/i.test(error.message)) { kv.set(cdKey(to), String(Date.now())); setLeft(COOLDOWN); return setErr("Please wait a moment before asking for another email."); }
      return setErr("We couldn't send that just now. Check the address and try again.");
    }
    kv.set(cdKey(to), String(Date.now())); setLeft(COOLDOWN); setSent(true);
  }, [run]);

  const toSignIn = (params: { mode: "in" | "up"; email?: string }) => router.replace({ pathname: "/login", params });

  // 1) Signed in: the link worked.
  if (session) {
    const first = (name || "").split(" ")[0];
    return (
      <AuthShell>
        <AppIcon size={48} />
        <Badge tone="ok" icon="check" />
        <View style={{ gap: 6, alignItems: "center" }}>
          <Heading size={26} lh={32} align="center">{`You're verified${first ? `, ${first}` : ""}`}</Heading>
          <Text tone="muted" align="center">Your email is confirmed and your account is ready.</Text>
        </View>
        <Button onPress={() => { clearPending(); router.replace("/"); }}>Continue to IQ Academy</Button>
      </AuthShell>
    );
  }

  // 2) We don't know which address to verify (opened directly or from another device).
  if (!email) {
    const send = () => { const v = typed.trim().toLowerCase(); if (!v) return setErr("Enter your email address."); setPending(v); setEmail(v); setLeft(0); resend(v); };
    return (
      <AuthShell>
        <AppIcon size={48} />
        <View style={{ gap: 6, alignItems: "center" }}>
          <Heading size={26} lh={32} align="center">Verify your email</Heading>
          <Text tone="muted" align="center">{"Enter the address you signed up with and we'll send a fresh link."}</Text>
        </View>
        <Card style={{ gap: 16, padding: 20 }}>
          <Field label="Email" value={typed} onChangeText={setTyped} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} returnKeyType="send" onSubmitEditing={send} />
          <Err>{err}</Err>
          <Button onPress={send}>Send verification link</Button>
        </Card>
        <Pressable accessibilityRole="button" onPress={() => toSignIn({ mode: "in" })} style={{ alignSelf: "center", minHeight: 44, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="arrowLeft" size={16} color={p.c.muted} /><Text size={14} tone="muted">Back to sign in</Text>
        </Pressable>
      </AuthShell>
    );
  }

  // 3) Waiting for the click (or the link expired).
  const inbox = inboxLink(email);
  const steps: [string, string][] = [["Open the email from IQ Academy", "It can take a minute. Check spam or promotions too."], ["Tap “Confirm your email”", "Any device works."], ["You'll be signed in automatically", "This screen updates itself if you confirm on this phone."]];
  return (
    <AuthShell>
      <AppIcon size={48} />
      <Badge tone={expired ? "warn" : "accent"} icon="mail" />
      <View style={{ gap: 6, alignItems: "center" }}>
        <Heading size={26} lh={32} align="center">{expired ? "That link has expired" : "Check your email"}</Heading>
        {expired
          ? <Text tone="muted" align="center">Confirmation links work once and only for a short time. Send yourself a new one.</Text>
          : <Text tone="muted" align="center">We sent a confirmation link to <Text weight="medium">{email}</Text></Text>}
      </View>

      {!expired && (
        <Card style={{ gap: 12, padding: 20 }}>
          {steps.map(([t, d], i) => (
            <View key={t} style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.c.sunken, alignItems: "center", justifyContent: "center" }}><Text size={12} weight="semibold" tone="muted">{i + 1}</Text></View>
              <View style={{ flex: 1 }}><Text size={14} weight="medium" lh={20}>{t}</Text><Text size={14} tone="muted" lh={20}>{d}</Text></View>
            </View>
          ))}
        </Card>
      )}

      <View style={{ gap: 12 }}>
        {inbox && !expired && <Button onPress={() => { Linking.openURL(inbox.url).catch(() => {}); }}>{`Open ${inbox.name}`}</Button>}
        <Button variant={inbox && !expired ? "secondary" : "primary"} disabled={left > 0} onPress={() => resend(email)}>
          {left > 0 ? `Resend email in ${left}s` : expired ? "Send a new link" : "Resend email"}
        </Button>
        <Err>{err}</Err>
        {sent && <View accessibilityLiveRegion="polite" style={{ borderRadius: 12, backgroundColor: p.a("ok", 0.1), paddingHorizontal: 12, paddingVertical: 8 }}><Text size={14} tone="ok">Sent. Look for the newest email in your inbox.</Text></View>}
      </View>

      <View style={{ alignItems: "center", gap: 4 }}>
        <Pressable accessibilityRole="button" onPress={() => toSignIn({ mode: "in", email })} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}><Text size={14} tone="accent">{"I've confirmed. Sign in"}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { clearPending(); toSignIn({ mode: "up" }); }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}><Text size={14} tone="muted">Wrong email? Start over</Text></Pressable>
      </View>
    </AuthShell>
  );
}
