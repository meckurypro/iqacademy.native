// Dev-only screen: run the M1 spikes on a real device build, then paste the report into port/DECISIONS.md.
import { useState } from "react";
import { ScrollView, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Redirect } from "expo-router";
import { env } from "@/core/env";
import { s1Intl, s3Storage, s4SqlCipher, type Check } from "@/dev/spikes/runner";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Button, Card, Heading, Text, useFeedback } from "@/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPIKES = [
  { id: "S1", title: "Hermes: Lagos time zone + Intl", run: s1Intl },
  { id: "S3", title: "Auth storage (SecureStore) + link parsing", run: s3Storage },
  { id: "S4", title: "SQLCipher: key gates the database", run: s4SqlCipher },
] as const;

export default function Spikes() {
  const { p } = useTheme(); const insets = useSafeAreaInsets(); const { run, toast } = useFeedback();
  const [results, setResults] = useState<Record<string, Check[]>>({});
  if (!env.devTools) return <Redirect href="/" />;
  const report = () => SPIKES.filter((s) => results[s.id]).map((s) => `## ${s.id} ${s.title}\n` + results[s.id].map((c) => `- [${c.status}] ${c.title}${c.detail ? `: ${c.detail}` : ""}`).join("\n")).join("\n\n");
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.c.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
      <Heading size={24}>Device spikes</Heading>
      <Text size={14} tone="muted">Run each on a development build (not Expo Go), then copy the report into port/DECISIONS.md. S2 (styling/perf), S5 (realtime), S6 (push), S7 (Paystack), S8 (QR) need their modules and a signed-in account: see port/SPIKES.md.</Text>
      {SPIKES.map((s) => (
        <Card key={s.id} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text weight="semibold" style={{ flex: 1 }}>{s.id} · {s.title}</Text>
            <Button variant="secondary" onPress={async () => { const r = await run(`Running ${s.id}…`, s.run, { quiet: false }); if (r.ok) setResults((x) => ({ ...x, [s.id]: r.data })); }}>Run</Button>
          </View>
          {results[s.id]?.map((c) => (
            <View key={c.id} style={{ gap: 4 }}>
              <Badge tone={c.status === "pass" ? "ok" : c.status === "fail" ? "bad" : "muted"}>{c.title}</Badge>
              {c.detail ? <Text size={12} tone="muted" selectable>{c.detail}</Text> : null}
            </View>
          ))}
        </Card>
      ))}
      <Button disabled={!Object.keys(results).length} onPress={async () => { await Clipboard.setStringAsync(report()); toast("Report copied"); }}>Copy report</Button>
    </ScrollView>
  );
}
