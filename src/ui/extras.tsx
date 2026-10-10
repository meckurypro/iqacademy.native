// Small primitives the staff and admin screens need and the web gets from the browser: multi-line input, switch row, segmented tabs,
// search box, and date/time pickers. The pickers work on centre (Lagos) wall-clock STRINGS ("2026-10-12", "10:30", "2026-10-12T10:30"),
// the same values <input type="date|time|datetime-local"> hold, so ports keep using fromWallInput/toWallInput. JS only: no native module.
import { useState, type ReactNode } from "react";
import { Pressable, Switch, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { haptic } from "@/native/haptics";
import { inRange, joinWall, monthGrid, shiftMonth, splitWall } from "@/shared/calendar";
import { fmtDay, today } from "@/shared/web/time";
import Icon from "./Icon";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { Button } from "./ui";

/** Multi-line field (web: textarea). Same look as Field; grows from `rows`. */
export function Area({ label, rows = 4, style, ...input }: Omit<TextInputProps, "style"> & { label: string; rows?: number; style?: object }) {
  const { p } = useTheme(); const [focus, setFocus] = useState(false);
  return (
    <View style={style}>
      <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{label}</Text>
      <TextInput {...input} multiline textAlignVertical="top" accessibilityLabel={input.accessibilityLabel ?? label} placeholderTextColor={p.a("muted", 0.6)} selectionColor={p.c.accent}
        onFocus={(e) => { setFocus(true); input.onFocus?.(e); }} onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        style={{ minHeight: rows * 22 + 24, borderRadius: radius.xl, backgroundColor: p.c.surface, borderWidth: focus ? 2 : 1, borderColor: focus ? p.a("accent", 0.6) : p.c.line, paddingHorizontal: focus ? 15 : 16, paddingVertical: focus ? 11 : 12, fontFamily: "Geist-Regular", fontSize: 15, lineHeight: 22, color: p.c.ink }} />
    </View>
  );
}

/** A labelled switch in a sunken box (web: checkbox row with a title and a hint). */
export function SwitchRow({ title, hint, value, onChange, disabled }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { p } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.xl, backgroundColor: p.c.sunken, padding: 12, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, minWidth: 0 }}><Text size={14} weight="medium">{title}</Text>{hint ? <Text size={14} tone="muted" lh={19}>{hint}</Text> : null}</View>
      <Switch accessibilityLabel={title} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: p.c.line, true: p.c.accent }} thumbColor="#fff" />
    </View>
  );
}

/** Two-to-four tabs in a sunken pill (web: grid of buttons in rounded-xl bg-sunken p-1). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { p } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, borderRadius: radius.xl, backgroundColor: p.c.sunken, padding: 4 }}>
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }} onPress={() => { haptic.select(); onChange(o.value); }}
          style={{ flex: 1, height: 40, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", backgroundColor: o.value === value ? p.c.surface : "transparent" }}>
          <Text size={14} weight="medium" tone={o.value === value ? "ink" : "muted"} numberOfLines={1}>{o.label}</Text>
        </Pressable>))}
    </View>
  );
}

/** Rounded search box with a magnifier (web: relative input with an Icon on the left). */
export function SearchField(props: Omit<TextInputProps, "style"> & { label: string }) {
  const { p } = useTheme(); const [focus, setFocus] = useState(false);
  return (
    <View style={{ height: 48, borderRadius: radius["2xl"], backgroundColor: p.c.surface, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: focus ? 15 : 16, borderWidth: focus ? 2 : 1, borderColor: focus ? p.a("accent", 0.5) : p.c.line }}>
      <Icon name="search" size={18} color={p.c.muted} />
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? props.label} autoCorrect={false} placeholderTextColor={p.a("muted", 0.6)} selectionColor={p.c.accent}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }} onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={{ flex: 1, height: "100%", fontFamily: "Geist-Regular", fontSize: 15, color: p.c.ink, padding: 0 }} />
    </View>
  );
}

// ---------- pickers ----------
const trigger = (p: ReturnType<typeof useTheme>["p"]) => ({ height: 48, borderRadius: radius.xl, backgroundColor: p.c.surface, borderWidth: 1, borderColor: p.c.line, paddingHorizontal: 16, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 });
const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function Cell({ on, off, ring, onPress, children, label }: { on?: boolean; off?: boolean; ring?: boolean; onPress: () => void; children: ReactNode; label: string }) {
  const { p } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on, disabled: !!off }} disabled={off} onPress={() => { haptic.select(); onPress(); }}
      style={{ flex: 1, height: 40, margin: 2, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", backgroundColor: on ? p.c.accent : "transparent", borderWidth: ring && !on ? 1 : 0, borderColor: p.c.accent, opacity: off ? 0.3 : 1 }}>
      <Text size={14} weight={on ? "semibold" : "regular"} num style={{ color: on ? p.c.accentInk : p.c.ink }}>{children}</Text>
    </Pressable>
  );
}

function Calendar({ value, onPick, min, max }: { value: string; onPick: (d: string) => void; min?: string; max?: string }) {
  const { p } = useTheme(); const shown0 = (value || today()).slice(0, 7); const [ym, setYm] = useState(shown0);
  const weeks = monthGrid(ym); const t = today();
  const canPrev = !min || shiftMonth(ym, -1) >= min.slice(0, 7); const canNext = !max || shiftMonth(ym, 1) <= max.slice(0, 7);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Pressable accessibilityLabel="Previous month" disabled={!canPrev} onPress={() => setYm(shiftMonth(ym, -1))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: canPrev ? 1 : 0.3 }}><Icon name="chevronLeft" size={20} /></Pressable>
        <Text weight="semibold">{fmtDay(`${ym}-01`, { month: "long", year: "numeric" })}</Text>
        <Pressable accessibilityLabel="Next month" disabled={!canNext} onPress={() => setYm(shiftMonth(ym, 1))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: canNext ? 1 : 0.3 }}><Icon name="chevronRight" size={20} /></Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>{WEEK.map((w, i) => <Text key={i} size={12} tone="muted" align="center" style={{ flex: 1 }}>{w}</Text>)}</View>
      {weeks.map((wk, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          {wk.map((d, j) => d
            ? <Cell key={d} on={d === value.slice(0, 10)} ring={d === t} off={!inRange(d, min, max)} label={fmtDay(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} onPress={() => onPick(d)}>{Number(d.slice(8))}</Cell>
            : <View key={`b${j}`} style={{ flex: 1, margin: 2, height: 40 }} />)}
        </View>))}
      <View style={{ height: 1, backgroundColor: p.c.line, marginTop: 8 }} />
    </View>
  );
}

function Grid({ items, value, onPick, label }: { items: string[]; value: string; onPick: (v: string) => void; label: string }) {
  const rows = Array.from({ length: Math.ceil(items.length / 6) }, (_, i) => items.slice(i * 6, i * 6 + 6));
  return <View>{rows.map((r, i) => <View key={i} style={{ flexDirection: "row" }}>{r.map((x) => <Cell key={x} on={x === value} label={`${label} ${x}`} onPress={() => onPick(x)}>{x}</Cell>)}</View>)}</View>;
}

function Trigger({ label, text, placeholder, onPress, icon }: { label: string; text: string; placeholder: string; onPress: () => void; icon: "schedule" | "today" }) {
  const { p } = useTheme();
  return (
    <View>
      <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${text || placeholder}`} onPress={onPress} style={trigger(p)}>
        <Text size={15} tone={text ? "ink" : "muted"} style={{ flex: 1 }} numberOfLines={1}>{text || placeholder}</Text>
        <Icon name={icon} size={18} color={p.a("muted", 0.7)} />
      </Pressable>
    </View>
  );
}

/** Date (web: type="date"). value "" or "YYYY-MM-DD"; min/max are ISO dates. Picking a day closes the sheet. */
export function DateField({ label, value, onChange, min, max, placeholder = "Choose a date" }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Trigger label={label} icon="today" text={value ? fmtDay(value, { day: "numeric", month: "short", year: "numeric" }) : ""} placeholder={placeholder} onPress={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <Calendar value={value} min={min} max={max} onPick={(d) => { onChange(d); setOpen(false); }} />
      </Sheet>
    </>
  );
}

/** Time of day (web: type="time"), 24 hour, minutes in 5s. value "" or "HH:mm". */
export function TimeField({ label, value, onChange, placeholder = "Choose a time" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [h, m] = value ? value.split(":") : ["", ""];
  const set = (nh: string, nm: string) => onChange(`${nh || "09"}:${nm || "00"}`);
  return (
    <>
      <Trigger label={label} icon="schedule" text={value} placeholder={placeholder} onPress={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <View style={{ gap: 12 }}>
          <Text size={13} weight="semibold" tone="muted" upper tracking={0.05}>Hour</Text>
          <Grid items={HOURS} value={h} label="Hour" onPick={(x) => set(x, m)} />
          <Text size={13} weight="semibold" tone="muted" upper tracking={0.05}>Minute</Text>
          <Grid items={MINUTES} value={m} label="Minute" onPick={(x) => set(h, x)} />
          <Button onPress={() => setOpen(false)}>Done</Button>
        </View>
      </Sheet>
    </>
  );
}

/** Date and time on the centre's wall clock (web: type="datetime-local"). value "" or "YYYY-MM-DDTHH:mm"; min/max in the same form. */
export function DateTimeField({ label, value, onChange, min, max, placeholder = "Choose date and time" }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const { date, time } = splitWall(value); const [h, m] = time ? time.split(":") : ["", ""];
  const shown = value ? `${fmtDay(date, { weekday: "short", day: "numeric", month: "short" })} · ${time}` : "";
  const clamp = (v: string) => (min && v < min ? min : max && v > max ? max : v);
  const put = (d: string, hh: string, mm: string) => onChange(clamp(joinWall(d, `${hh || "09"}:${mm || "00"}`)));
  return (
    <>
      <Trigger label={label} icon="schedule" text={shown} placeholder={placeholder} onPress={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <View style={{ gap: 12 }}>
          <Calendar value={date} min={min?.slice(0, 10)} max={max?.slice(0, 10)} onPick={(d) => put(d, h, m)} />
          <Text size={13} weight="semibold" tone="muted" upper tracking={0.05}>Hour</Text>
          <Grid items={HOURS} value={h} label="Hour" onPick={(x) => put(date || today(), x, m)} />
          <Text size={13} weight="semibold" tone="muted" upper tracking={0.05}>Minute</Text>
          <Grid items={MINUTES} value={m} label="Minute" onPick={(x) => put(date || today(), h, x)} />
          <Button disabled={!value} onPress={() => setOpen(false)}>Done</Button>
        </View>
      </Sheet>
    </>
  );
}
