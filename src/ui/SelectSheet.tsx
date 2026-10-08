// Replaces <select> (17 uses on the web). Looks like a Field; tapping opens a sheet of options.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { haptic } from "@/native/haptics";
import Icon from "./Icon";
import { Sheet } from "./Sheet";
import { Text } from "./Text";

export type Option<T extends string> = { value: T; label: string; hint?: string };
export function SelectSheet<T extends string>({ label, value, options, onChange, placeholder = "Choose…", title }: { label: string; value: T | null | undefined; options: Option<T>[]; onChange: (v: T) => void; placeholder?: string; title?: string }) {
  const { p } = useTheme(); const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <View>
      <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${cur?.label ?? placeholder}`} onPress={() => setOpen(true)}
        style={{ height: 48, borderRadius: radius.xl, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text size={15} tone={cur ? "ink" : "muted"} style={{ flex: 1 }} numberOfLines={1}>{cur?.label ?? placeholder}</Text>
        <Icon name="chevronDown" size={16} color={p.a("muted", 0.7)} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={title ?? label}>
        <View style={{ marginHorizontal: -20 }}>
          {options.map((o) => (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: o.value === value }} onPress={() => { haptic.select(); onChange(o.value); setOpen(false); }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: pressed ? p.c.sunken : "transparent" })}>
              <View style={{ flex: 1 }}>
                <Text weight={o.value === value ? "semibold" : "regular"}>{o.label}</Text>
                {o.hint && <Text size={14} tone="muted" lh={19}>{o.hint}</Text>}
              </View>
              {o.value === value && <Icon name="check" size={18} color={p.c.accent} />}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}
