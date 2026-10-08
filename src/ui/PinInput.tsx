// The check-in PIN field: exactly four digits, always a numeric keypad, always dots. (PinSetup/ChangePinForm are M7a/M13.)
// Four boxes drawn over one real, invisible TextInput, so paste, autofill-off and the OS keypad all behave.
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Text } from "./Text";

export const PIN_LENGTH = 4;

export function PinInput({ value, onChange, label, autoFocus, disabled, invalid, onComplete }: { value: string; onChange: (v: string) => void; label?: string; autoFocus?: boolean; disabled?: boolean; invalid?: boolean; onComplete?: (v: string) => void }) {
  const { p } = useTheme(); const ref = useRef<TextInput>(null); const [focused, setFocused] = useState(false);
  const set = (raw: string) => { const v = raw.replace(/\D/g, "").slice(0, PIN_LENGTH); onChange(v); if (v.length === PIN_LENGTH) onComplete?.(v); };
  return (
    <View>
      {label && <Text size={14} weight="medium" align="center" style={{ marginBottom: 8 }}>{label}</Text>}
      <Pressable onPress={() => ref.current?.focus()} accessibilityRole="none" style={{ alignSelf: "center" }}>
        <View style={{ flexDirection: "row", gap: 12 }} importantForAccessibility="no-hide-descendants">
          {Array.from({ length: PIN_LENGTH }, (_, i) => {
            const active = focused && i === Math.min(value.length, PIN_LENGTH - 1);
            return (
              <View key={i} style={{ width: 48, height: 56, borderRadius: radius.xl, backgroundColor: p.c.surface, alignItems: "center", justifyContent: "center",
                borderWidth: active ? 2 : 1, borderColor: invalid ? p.a("bad", 0.6) : active ? p.c.accent : p.c.line }}>
                {value[i] ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.c.ink }} /> : null}
              </View>
            );
          })}
        </View>
        <TextInput ref={ref} value={value} onChangeText={set} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} keyboardType="number-pad" maxLength={PIN_LENGTH}
          autoComplete="off" autoCorrect={false} autoCapitalize="none" textContentType="none" importantForAutofill="no" caretHidden contextMenuHidden returnKeyType="done"
          autoFocus={autoFocus} editable={!disabled} accessibilityLabel={label ?? "4-digit PIN"} style={{ position: "absolute", inset: 0, opacity: 0.02, fontSize: 16 }} />
      </Pressable>
    </View>
  );
}
