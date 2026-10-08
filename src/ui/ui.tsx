// Port of web components/ui.tsx. Same names, same dimensions (px = dp), same tones. Class strings from the web are noted beside each piece.
import { useEffect, useState, Children, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, shadow, type Palette, type Tone } from "@/theme/tokens";
import { haptic } from "@/native/haptics";
import Icon, { type IconName } from "./Icon";
import { Heading, Text } from "./Text";

export type { Tone };
/** Blur is iOS-only for now: Android's blur is costly on low-end phones (ADR-002, spike S2). Android gets a solid, slightly more opaque surface. */
export const BLUR = Platform.OS === "ios";

// tones: bg-ok/10 text-ok … ; muted: bg-sunken text-muted
export const toneColors = (p: Palette, tone: Tone) =>
  tone === "muted" ? { bg: p.c.sunken, fg: p.c.muted, dot: p.a("muted", 0.6) } : { bg: p.a(tone, 0.1), fg: p.c[tone], dot: p.c[tone] };

// ---------- Button: h-11 rounded-xl px-5 text-[15px] font-medium, gap-2 ----------
type ButtonProps = { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean; disabled?: boolean; onPress?: () => void; children?: ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string; testID?: string; icon?: IconName };
export function Button({ variant = "primary", loading, disabled, onPress, children, style, icon, ...a }: ButtonProps) {
  const { p } = useTheme();
  const off = disabled || loading;
  const fg = variant === "primary" || variant === "danger" ? p.c.accentInk : variant === "secondary" ? p.c.ink : p.c.muted;
  return (
    <Pressable {...a} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} disabled={off} onPress={() => { haptic.tap(); onPress?.(); }}
      style={({ pressed }) => [{
        height: 44, borderRadius: radius.xl, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: off ? 0.5 : 1,
        backgroundColor: variant === "primary" ? p.c.accent : variant === "danger" ? p.c.bad : variant === "secondary" ? (pressed ? p.c.sunken : p.c.surface) : pressed ? p.c.sunken : "transparent",
        borderWidth: variant === "secondary" ? 1 : 0, borderColor: p.c.line, transform: [{ scale: pressed && !off ? 0.98 : 1 }],
      }, style]}>
      {loading && <ActivityIndicator size="small" color={fg} />}
      {icon && <Icon name={icon} size={18} color={fg} />}
      {typeof children === "string" ? <Text size={15} weight="medium" style={{ color: fg }}>{children}</Text> : children}
    </Pressable>
  );
}

// ---------- Glass: translucent, softly blurred, hairline edge, faint top highlight ----------
export function Glass({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { p, scheme } = useTheme();
  const dark = scheme === "dark";
  return (
    <View style={[{ borderRadius: radius["2xl"], overflow: "hidden", borderWidth: 1, borderColor: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.55)" }, style]}>
      {BLUR && <BlurView intensity={40} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: p.a("surface", BLUR ? (dark ? 0.5 : 0.6) : 0.92) }]} />
      <LinearGradient pointerEvents="none" colors={[dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.22)", "transparent"]} locations={[0, 0.45]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

// ---------- Card: rounded-2xl p-4 shadow-card, bg-surface + ring-1 ring-line unless a variant says otherwise ----------
type CardProps = { variant?: "surface" | "accent" | "sunken" | "glass"; onPress?: () => void; children?: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean };
export function Card({ variant = "surface", onPress, children, style, padded = true }: CardProps) {
  const { p } = useTheme();
  const body: ViewStyle = { padding: padded ? 16 : 0 };
  if (variant === "glass") {
    const g = <Glass style={style}><View style={body}>{children}</View></Glass>;
    return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{g}</Pressable> : g;
  }
  const base: ViewStyle = { borderRadius: radius["2xl"], ...body, ...shadow.card,
    backgroundColor: variant === "accent" ? p.c.accent : variant === "sunken" ? p.c.sunken : p.c.surface,
    borderWidth: variant === "accent" ? 0 : 1, borderColor: p.c.line };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.99 : 1 }] }, style]}>{children}</Pressable>;
}

// ---------- Skeleton: rounded-xl bg-sunken with a travelling highlight (1.4 s) ----------
export function Skeleton({ style, height = 20 }: { style?: StyleProp<ViewStyle>; height?: number }) {
  const { p } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const [w, setW] = useState(0);
  useEffect(() => { if (!reduce) t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false); }, [reduce, t]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: (t.value * 2 - 1) * w }] }));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ height, width: "100%", borderRadius: radius.xl, backgroundColor: p.c.sunken, overflow: "hidden" }, style]}>
      {!reduce && w > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
          <LinearGradient colors={["transparent", p.a("surface", 0.6), "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      )}
    </View>
  );
}

// ---------- Avatar: image, or initials on a hue-hashed gradient (same hash as web) ----------
export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />;
  return (
    <LinearGradient colors={[`hsl(${hue}, 70%, 62%)`, `hsl(${(hue + 40) % 360}, 70%, 50%)`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
      <Text size={size * 0.38} weight="semibold" style={{ color: "#fff", lineHeight: size * 0.38 * 1.2 }}>{initials}</Text>
    </LinearGradient>
  );
}

// ---------- Field: label (14 medium, mb 6) + h-12 rounded-xl input, ring-1 line → ring-2 accent/60 on focus ----------
type FieldProps = Omit<TextInputProps, "style"> & { label: string; error?: boolean; right?: ReactNode; style?: StyleProp<ViewStyle> };
export function Field({ label, error, right, style, onFocus, onBlur, ...input }: FieldProps) {
  const { p } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={style}>
      <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{label}</Text>
      <View style={{ height: 48, borderRadius: radius.xl, backgroundColor: p.c.surface, flexDirection: "row", alignItems: "center",
        borderWidth: focus ? 2 : 1, borderColor: error ? p.a("bad", 0.6) : focus ? p.a("accent", 0.6) : p.c.line, paddingHorizontal: focus ? 15 : 16 }}>
        <TextInput {...input} accessibilityLabel={input.accessibilityLabel ?? label} placeholderTextColor={p.a("muted", 0.6)} selectionColor={p.c.accent}
          onFocus={(e) => { setFocus(true); onFocus?.(e); }} onBlur={(e) => { setFocus(false); onBlur?.(e); }}
          style={{ flex: 1, height: "100%", fontFamily: "Geist-Regular", fontSize: 15, color: p.c.ink, padding: 0 }} />
        {right}
      </View>
    </View>
  );
}

// ---------- Badge / IconTile ----------
export const Badge = ({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) => {
  const { p } = useTheme(); const t = toneColors(p, tone);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: t.bg }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.dot }} />
      <Text size={12} weight="medium" lh={16} style={{ color: t.fg }} numberOfLines={1}>{children}</Text>
    </View>
  );
};
export const IconTile = ({ tone = "muted", size = 40, children }: { tone?: Tone; size?: number; children: ReactNode }) => {
  const { p } = useTheme(); const t = toneColors(p, tone);
  return <View style={{ width: size, height: size, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>{children}</View>;
};
/** Colour for an icon inside an IconTile of this tone (muted tiles use ink/70). */
export const tileIconColor = (p: Palette, tone: Tone) => (tone === "muted" ? p.a("ink", 0.7) : p.c[tone]);

// ---------- NavRow / List ----------
export function NavRow({ to, onPress, icon, title, hint, tone = "muted", badge }: { to?: string; onPress?: () => void; icon: IconName; title: string; hint?: string; tone?: Tone; badge?: ReactNode }) {
  const { p } = useTheme(); const router = useRouter();
  return (
    <Pressable accessibilityRole="link" onPress={() => { haptic.select(); if (onPress) onPress(); else if (to) router.push(to as Href); }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? p.c.sunken : "transparent" })}>
      <IconTile tone={tone}><Icon name={icon} size={20} color={tileIconColor(p, tone)} /></IconTile>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="medium" lh={22}>{title}</Text>
        {hint && <Text size={14} tone="muted" lh={19} style={{ marginTop: 2 }}>{hint}</Text>}
      </View>
      {badge}
      <Icon name="chevronRight" size={16} color={p.a("muted", 0.7)} />
    </Pressable>
  );
}
/** A group of rows in one card, separated by hairlines (web: divide-y divide-line). */
export const List = ({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) => {
  const { p } = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ borderRadius: radius["2xl"], backgroundColor: p.c.surface, overflow: "hidden", borderWidth: 1, borderColor: p.c.line, ...shadow.card }, style]}>
      {rows.map((c, i) => <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: p.c.line } : undefined}>{c}</View>)}
    </View>
  );
};

// ---------- headings, sections, empty, stat, error ----------
export const PageHeader = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, paddingTop: 4 }}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Heading size={26} lh={32}>{title}</Heading>
      {sub && <Text size={15} tone="muted" style={{ marginTop: 4 }}>{sub}</Text>}
    </View>
    {action}
  </View>
);
export const Section = ({ title, aside, children, style }: { title: string; aside?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ gap: 12 }, style]}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingHorizontal: 2 }}>
      <Text size={13} weight="semibold" tone="muted" upper tracking={0.05} lh={19}>{title}</Text>
      {aside != null && (typeof aside === "string" ? <Text size={14} tone="muted">{aside}</Text> : aside)}
    </View>
    {children}
  </View>
);
export const Empty = ({ icon = "inbox", title, hint }: { icon?: IconName; title: string; hint?: string }) => {
  const { p } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 8, borderRadius: radius["2xl"], borderWidth: 1, borderStyle: "dashed", borderColor: p.c.line, paddingHorizontal: 24, paddingVertical: 40 }}>
      <IconTile size={44}><Icon name={icon} size={22} color={tileIconColor(p, "muted")} /></IconTile>
      <Text weight="medium" align="center">{title}</Text>
      {hint && <Text size={14} tone="muted" align="center" style={{ maxWidth: 320 }}>{hint}</Text>}
    </View>
  );
};
export const Stat = ({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: Tone }) => {
  const { p } = useTheme();
  return (
    <View style={{ borderRadius: radius["2xl"], backgroundColor: p.c.surface, padding: 16, borderWidth: 1, borderColor: p.c.line, ...shadow.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {tone && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneColors(p, tone).dot }} />}
        <Text size={13} tone="muted" lh={19}>{label}</Text>
      </View>
      <Text size={24} weight="semibold" tracking={-0.025} num style={{ marginTop: 6 }}>{value}</Text>
      {sub && <Text size={12} tone="muted" style={{ marginTop: 2 }}>{sub}</Text>}
    </View>
  );
};
export const Err = ({ children }: { children?: ReactNode }) => {
  const { p } = useTheme();
  if (!children) return null;
  return <View accessibilityRole="alert" style={{ borderRadius: radius.xl, backgroundColor: p.a("bad", 0.1), paddingHorizontal: 14, paddingVertical: 10 }}><Text size={14} tone="bad">{children}</Text></View>;
};

// Dashboard layout. Phones are one column; Rail comes first in markup so reading order is kept. (Desktop split is not ported: D6.)
export const Split = ({ children }: { children?: ReactNode }) => <View style={{ gap: 24 }}>{children}</View>;
export const Main = ({ children }: { children?: ReactNode }) => <View style={{ gap: 24, minWidth: 0 }}>{children}</View>;
export const Rail = ({ children }: { children?: ReactNode }) => <View style={{ gap: 24 }}>{children}</View>;
