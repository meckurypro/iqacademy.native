// Port of web ClockNotice: tells the person when their phone's clock is off. The app itself always shows server time.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Icon, Text } from "@/ui";

const TOLERANCE_MS = 2 * 60000; // a couple of minutes either way is normal and not worth a warning

export default function ClockNotice({ skew }: { skew: number }) {
  const { p } = useTheme(); const [hidden, setHidden] = useState(false);
  if (hidden || Math.abs(skew) < TOLERANCE_MS) return null;
  const mins = Math.round(Math.abs(skew) / 60000);
  const gap = mins >= 120 ? `${Math.round(mins / 60)} hours` : mins >= 60 ? `${Math.round(mins / 6) / 10} hours` : `${mins} minutes`;
  return (
    <View accessibilityRole="alert" style={{ marginBottom: 16, flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: radius.xl, backgroundColor: p.a("warn", 0.1), paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ marginTop: 2 }}><Icon name="alert" size={18} color={p.c.warn} /></View>
      <Text size={14} style={{ flex: 1 }}>{`Your phone's clock is about ${gap} ${skew > 0 ? "slow" : "fast"}. The app shows the correct time, but turn on automatic date and time in your phone's settings so other apps and alarms agree.`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={12} onPress={() => setHidden(true)}><Icon name="close" size={16} color={p.c.muted} /></Pressable>
    </View>
  );
}
