import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { haptic } from "@/native/haptics";
import { RATING_WORDS } from "@/shared/web/consts";
import Icon from "./Icon";
import { Text } from "./Text";

export { RATING_WORDS };

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const { p } = useTheme();
  return (
    <View accessibilityRole="image" accessibilityLabel={`${value} out of 5 stars`} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" size={size} solid={n <= value} color={n <= value ? p.c.accent : p.c.line} />)}
    </View>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { p } = useTheme();
  return (
    <View style={{ gap: 8, alignItems: "center" }}>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={`${n} star${n === 1 ? "" : "s"}, ${RATING_WORDS[n]}`}
            onPress={() => { haptic.select(); onChange(n); }} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.9 : 1 }] })}>
            <Icon name="star" size={34} solid={n <= value} color={n <= value ? p.c.accent : p.c.line} />
          </Pressable>
        ))}
      </View>
      <Text size={14} weight="medium" style={{ height: 20, opacity: value ? 1 : 0 }}>{RATING_WORDS[value] ?? ""}</Text>
    </View>
  );
}
