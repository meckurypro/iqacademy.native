// Port of web pages/PayCallback.tsx @d14323f. Where the Paystack return page lands if the OS opens it in the app (universal link). Native does not depend on it
// (ADR-012: payFlow asks the server itself when the browser closes), but if it is opened it must do the right thing and never claim success without asking.
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/shell/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Card, Heading, Icon, Text } from "@/ui";
import type { PayStatus } from "./pay";
import { verifyPayment } from "./payFlow";

export default function PayCallback() {
  const { p } = useTheme(); const router = useRouter();
  const q = useLocalSearchParams<{ reference?: string; trxref?: string }>();
  const ref = (typeof q.reference === "string" && q.reference) || (typeof q.trxref === "string" && q.trxref) || "";
  const [asked, setAsked] = useState<{ ref: string; status: PayStatus } | null>(null);
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    verifyPayment(ref).then((s) => { if (alive) setAsked({ ref, status: s }); }).catch(() => { if (alive) setAsked({ ref, status: "pending" }); }); // could not ask (offline): not "failed", just not known yet
    return () => { alive = false; };
  }, [ref]);
  const status: "checking" | PayStatus = !ref ? "failed" : asked?.ref === ref ? asked.status : "checking";

  return (
    <Screen>
      <Card style={{ alignItems: "center", gap: 16, padding: 32, marginTop: 24 }}>
        {status === "checking" ? <><ActivityIndicator size="large" color={p.c.accent} /><Text>Confirming your payment…</Text></> : null}
        {status === "succeeded" ? <>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: p.a("ok", 0.15) }}><Icon name="check" size={32} color={p.c.ok} /></View>
          <Heading size={26} lh={32} align="center">{"You're in!"}</Heading><Text tone="muted" align="center">Payment received. See your classes on Home.</Text></> : null}
        {status === "pending" ? <><Heading size={26} lh={32} align="center">Still confirming</Heading><Text tone="muted" align="center">{"Your bank is taking a moment. We'll update your account as soon as it lands."}</Text></> : null}
        {status === "failed" ? <><Heading size={26} lh={32} align="center">Payment not completed</Heading><Text tone="muted" align="center">No money was taken. You can try again from Home.</Text></> : null}
        <Button style={{ width: "100%" }} onPress={() => router.replace("/")}>Go to Home</Button>
      </Card>
    </Screen>
  );
}
