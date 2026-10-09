// Dev-only component gallery (M2). Screenshot this next to the web app at 390px to check visual parity.
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Redirect } from "expo-router";
import { env } from "@/core/env";
import { ICONS } from "@/ui/icons.generated";
import { useTheme, type ThemePref } from "@/theme/ThemeProvider";
import { Avatar, Badge, Button, Card, Chip, ChipRow, Empty, Err, Field, Glass, Heading, Icon, IconTile, List, NavRow, PageHeader, PinInput, SelectSheet, Sheet, Skeleton, Stars, StarPicker, Stat, StatStrip, Section, Text, tileIconColor, useFeedback, type IconName, type Tone } from "@/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TONES: Tone[] = ["ok", "warn", "bad", "info", "accent", "muted"];

export default function Gallery() {
  const { p, pref, setPref } = useTheme(); const insets = useSafeAreaInsets(); const { run, toast, confirm } = useFeedback();
  const [sheet, setSheet] = useState(false); const [pin, setPin] = useState(""); const [stars, setStars] = useState(4); const [sel, setSel] = useState<string>("b"); const [chip, setChip] = useState("all");
  if (!env.devTools) return <Redirect href="/" />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.c.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, gap: 28 }}>
      <PageHeader title="Gallery" sub="Design system, side by side with the web" />
      <Section title="Theme">
        <View style={{ flexDirection: "row", gap: 8 }}>{(["light", "dark", "system"] as ThemePref[]).map((t) => <Button key={t} variant={pref === t ? "primary" : "secondary"} onPress={() => setPref(t)} style={{ flex: 1 }}>{t}</Button>)}</View>
      </Section>
      <Section title="Buttons">
        <View style={{ gap: 8 }}>
          <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button>
          <Button loading>Loading</Button><Button disabled>Disabled</Button><Button icon="check">With icon</Button>
        </View>
      </Section>
      <Section title="Cards" aside="glass is iOS-blurred">
        <Card><Text weight="medium">Surface card</Text><Text size={14} tone="muted">rounded-2xl, ring, shadow-card</Text></Card>
        <Card variant="accent"><Text weight="medium" style={{ color: p.c.accentInk }}>Accent card</Text></Card>
        <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: p.c.accent, padding: 16 }}><Glass><View style={{ padding: 16 }}><Text weight="medium">Glass over colour</Text></View></Glass></View>
      </Section>
      <Section title="Badges and tiles">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{TONES.map((t) => <Badge key={t} tone={t}>{t}</Badge>)}</View>
        <View style={{ flexDirection: "row", gap: 8 }}>{TONES.map((t) => <IconTile key={t} tone={t}><Icon name="bell" size={20} color={tileIconColor(p, t)} /></IconTile>)}</View>
      </Section>
      <Section title="List"><List><NavRow icon="bell" title="Notifications" hint="3 unread" tone="info" /><NavRow icon="enrol" title="Enrol in a course" tone="accent" /><NavRow icon="users" title="Profile" /></List></Section>
      <Section title="Stats"><View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Stat label="Students" value="1,284" tone="ok" sub="this month" /></View><View style={{ flex: 1 }}><Stat label="Owed" value="₦150,000" tone="warn" /></View></View></Section>
      <Section title="Compact stats, strip, chips">
        <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Stat compact label="This month" value="₦1,250,000" tone="ok" sub="paid in" /></View><View style={{ flex: 1 }}><Stat compact label="Owed" value="₦12,345,678,900" tone="warn" sub="long amounts step down" /></View></View>
        <StatStrip items={[{ label: "Present", value: 18, tone: "ok" }, { label: "Absent", value: 3, tone: "bad" }, { label: "Excused", value: 1 }]} />
        <ChipRow>{["all", "active", "pending", "completed", "cancelled"].map((c) => <Chip key={c} on={chip === c} onPress={() => setChip(c)}>{c}</Chip>)}</ChipRow>
      </Section>
      <Section title="Empty, error, skeleton"><Empty title="Nothing here yet" hint="Things you add will show up here." /><Err>{"That code isn't right. Check it and try again."}</Err><Skeleton height={20} /><Skeleton height={64} /></Section>
      <Section title="Inputs">
        <Field label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="With error" error defaultValue="oops" />
        <SelectSheet label="Centre" value={sel} onChange={setSel} options={[{ value: "a", label: "Lagos" }, { value: "b", label: "Abuja", hint: "Wuse 2" }, { value: "c", label: "Port Harcourt" }]} />
        <PinInput value={pin} onChange={setPin} label="Check-in PIN" />
        <View style={{ alignItems: "center", gap: 12 }}><Stars value={stars} size={20} /><StarPicker value={stars} onChange={setStars} /></View>
      </Section>
      <Section title="Avatars"><View style={{ flexDirection: "row", gap: 12 }}>{["Ada Obi", "Tunde", "Chioma N", "Z"].map((n) => <Avatar key={n} name={n} size={44} />)}</View></Section>
      <Section title="Feedback">
        <View style={{ gap: 8 }}>
          <Button variant="secondary" onPress={() => setSheet(true)}>Open sheet</Button>
          <Button variant="secondary" onPress={() => run("Saving…", () => new Promise((r) => setTimeout(r, 1500)), { success: "Saved" })}>Busy overlay → toast</Button>
          <Button variant="secondary" onPress={() => run("Failing…", async () => { throw new Error("invalid_code"); })}>Error toast</Button>
          <Button variant="secondary" onPress={() => toast("Back online notice: switch to airplane mode for ~25 s to see the offline card", "ok")}>How to see the offline card</Button>
          <Button variant="secondary" onPress={async () => toast((await confirm({ title: "Delete this class?", message: "Students will be told it was cancelled.", confirmLabel: "Delete", danger: true })) ? "Confirmed" : "Cancelled")}>Confirm (danger)</Button>
        </View>
      </Section>
      <Section title={`Icons (${Object.keys(ICONS).length})`}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {(Object.keys(ICONS) as IconName[]).map((n) => <View key={n} style={{ width: 64, alignItems: "center", gap: 4 }}><View style={{ flexDirection: "row", gap: 6 }}><Icon name={n} size={22} /><Icon name={n} size={22} solid color={p.c.accent} cutColor={p.c.bg} /></View><Text size={10} tone="muted" numberOfLines={1}>{n}</Text></View>)}
        </View>
      </Section>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Sheet title"><Text tone="muted">Bottom sheet: backdrop tap, Android back, and drag handle all close it.</Text><View style={{ height: 12 }} /><Heading size={18}>Heading</Heading><View style={{ height: 12 }} /><Button onPress={() => setSheet(false)}>Done</Button></Sheet>
    </ScrollView>
  );
}
