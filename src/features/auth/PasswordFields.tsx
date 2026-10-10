// src/features/auth/PasswordFields.tsx
// Port of web components/PasswordFields.tsx: PasswordField (eye toggle), StrengthMeter, PasswordChecklist, PasswordCreator (generator + copy), MatchHint.
import { useEffect, useRef, useState } from "react";
import { Pressable, View, type TextInputProps } from "react-native";
import * as Clipboard from "expo-clipboard";
import { RULES, generatePassword, strength } from "@/shared/web/password";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Field, Icon, Text } from "@/ui";

type PwProps = Omit<TextInputProps, "style" | "value" | "onChangeText" | "secureTextEntry"> & {
  label: string; value: string; onValue: (v: string) => void;
  /** Optional controlled visibility (used when a generated password should be revealed). */
  show?: boolean; onShow?: (s: boolean) => void;
};

/** Password input with a show/hide toggle. */
export function PasswordField({ label, value, onValue, show, onShow, ...rest }: PwProps) {
  const { p } = useTheme(); const [inner, setInner] = useState(false);
  const visible = show ?? inner; const set = (s: boolean) => (onShow ? onShow(s) : setInner(s));
  return (
    <Field {...rest} label={label} value={value} onChangeText={onValue} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false}
      right={
        <Pressable onPress={() => set(!visible)} accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} accessibilityState={{ selected: visible }} hitSlop={8}
          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: -8, backgroundColor: pressed ? p.c.sunken : "transparent" })}>
          <Icon name={visible ? "eyeOff" : "eye"} size={20} color={p.c.muted} />
        </Pressable>
      } />
  );
}

export function StrengthMeter({ password }: { password: string }) {
  const { p } = useTheme(); const { level, label } = strength(password);
  const fill = ["", p.c.bad, p.c.warn, p.a("ok", 0.6), p.c.ok][level];
  const text = ["muted", "bad", "warn", "ok", "ok"][level] as "muted" | "bad" | "warn" | "ok";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }} accessibilityLiveRegion="polite" accessibilityLabel={label ? `Password strength: ${label}` : undefined}>
      <View style={{ flex: 1, flexDirection: "row", gap: 6 }} importantForAccessibility="no-hide-descendants">
        {[1, 2, 3, 4].map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= level ? fill : p.c.line }} />)}
      </View>
      <Text size={12} weight="medium" tone={text} align="right" style={{ width: 56 }}>{label || " "}</Text>
    </View>
  );
}

export function PasswordChecklist({ password }: { password: string }) {
  const { p } = useTheme();
  return (
    <View accessibilityLabel="Password requirements" style={{ gap: 6 }}>
      {RULES.map((r) => {
        const done = r.test(password);
        return (
          <View key={r.id} accessible accessibilityLabel={`${r.label}${done ? " (done)" : " (not yet)"}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: done ? p.c.ok : "transparent", borderWidth: done ? 0 : 1, borderColor: p.c.line }}>
              {done && <Icon name="check" size={10} color="#fff" />}
            </View>
            <Text size={13} tone={done ? "ok" : "muted"}>{r.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Everything needed to create a strong password: input + eye toggle, strength meter, live checklist, generator. */
export function PasswordCreator({ label = "Password", value, onValue, onGenerate, ...rest }:
  { label?: string; value: string; onValue: (v: string) => void; onGenerate?: (pw: string) => void } & Omit<PwProps, "label" | "value" | "onValue" | "show" | "onShow">) {
  const { p } = useTheme(); const [show, setShow] = useState(false); const [generated, setGenerated] = useState(false); const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const suggest = () => { const pw = generatePassword(); onValue(pw); onGenerate?.(pw); setShow(true); setGenerated(true); setCopied(false); };
  const copy = async () => {
    try { await Clipboard.setStringAsync(value); setCopied(true); timer.current = setTimeout(() => setCopied(false), 1800); } catch { /* the password is visible, so it can be copied by hand */ }
  };
  const pill = (pressed: boolean, tint: boolean) => ({ flexDirection: "row" as const, alignItems: "center" as const, gap: 8, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, backgroundColor: tint ? p.a("accent", pressed ? 0.18 : 0.1) : pressed ? p.c.line : p.c.sunken });
  return (
    <View style={{ gap: 12 }}>
      <PasswordField autoComplete="new-password" textContentType="newPassword" {...rest} label={label} value={value} onValue={(v) => { setGenerated(false); onValue(v); }} show={show} onShow={setShow} />
      <StrengthMeter password={value} />
      <PasswordChecklist password={value} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Pressable accessibilityRole="button" onPress={suggest} style={({ pressed }) => pill(pressed, true)}>
          <Icon name="key" size={16} color={p.c.accent} /><Text size={14} weight="medium" tone="accent">Suggest a strong password</Text>
        </Pressable>
        {generated && !!value && (
          <Pressable accessibilityRole="button" onPress={copy} style={({ pressed }) => pill(pressed, false)}>
            {copied && <Icon name="check" size={15} />}<Text size={14} weight="medium">{copied ? "Copied" : "Copy"}</Text>
          </Pressable>
        )}
      </View>
      {generated && <Text size={12} tone="muted">{"Save it in your password manager or copy it now. You'll need it to sign in."}</Text>}
    </View>
  );
}

export function MatchHint({ a, b }: { a: string; b: string }) {
  const { p } = useTheme();
  if (!b) return null;
  const same = a === b;
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: -4 }}>
      {same && <Icon name="check" size={14} color={p.c.ok} />}
      <Text size={12} tone={same ? "ok" : "bad"}>{same ? "Passwords match" : "Passwords don't match yet"}</Text>
    </View>
  );
}
