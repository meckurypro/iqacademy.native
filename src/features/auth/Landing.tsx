// src/features/auth/Landing.tsx
// Port of web src/pages/Landing.tsx @d14323f (served at /welcome: on native "/" is the signed-in home).
// Differences, recorded in port/PARITY.md: the web's two buttons ("On mobile? Get the app" / "Continue on PC") become "Create an account" / "Sign in",
// since the person is already in the app; the header "Sign in" link stays.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRpc } from "@/data";
import { fmtWhen, now } from "@/shared/web/time";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Button, Heading, Stars, Text } from "@/ui";
import { AppIcon } from "./AuthShell";

const LINES = [
  "Practical AI skills, taught by people who build with AI.",
  "Understand. Design. Build. Automate.",
  "Affordable training, online and at a centre near you.",
  "Learn online, in a workshop, or one-on-one.",
  "Start from zero and leave with something you built.",
  "Join a cohort. Show up. Ship real work.",
];

// People trained before online payments existed; every paying student is added on top.
const BASE_TRAINED = 100;
type Stats = { centres: number; courses: number; paid: number };
type Review = { id: string; rating: number; comment: string; student_name: string; student_avatar: string | null; created_at: string; course_title: string | null };

/** 100 → "100+", 110 → "110+" (tens); from 1,000 up → "1k+", "1.2k+" (hundreds); millions → "1.2M+". */
const people = (n: number) => {
  if (n < 1000) return `${Math.floor(n / 10) * 10}+`;
  if (n < 1e6) return `${Math.floor(n / 100) / 10}k+`;
  return `${Math.floor(n / 1e5) / 10}M+`;
};

function useReduceMotion() {
  const [r, setR] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setR).catch(() => {}); const s = AccessibilityInfo.addEventListener("reduceMotionChanged", setR); return () => s.remove(); }, []);
  return r;
}

function useCountUp(target: number, run: boolean, reduce: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run || reduce) return;
    let raf = 0; const t0 = Date.now(); // animation timing only: never shown
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / 1600);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, reduce]);
  return run && reduce ? target : v;
}

function Typewriter({ lines, reduce }: { lines: string[]; reduce: boolean }) {
  const { p } = useTheme();
  const [i, setI] = useState(0); const [n, setN] = useState(0); const [out, setOut] = useState(false); const [caret, setCaret] = useState(true);
  const text = lines[i];
  useEffect(() => {
    const next = () => setI((v) => (v + 1) % lines.length);
    let id: ReturnType<typeof setTimeout>;
    if (reduce) id = setTimeout(next, 3000);
    else if (out) id = setTimeout(() => { setOut(false); setN(0); next(); }, 350);
    else if (n < text.length) id = setTimeout(() => setN(n + 1), 42);
    else id = setTimeout(() => setOut(true), 2000);
    return () => clearTimeout(id);
  }, [i, n, out, reduce, text, lines.length]);
  useEffect(() => { if (reduce) return; const t = setInterval(() => setCaret((c) => !c), 530); return () => clearInterval(t); }, [reduce]);
  return (
    <View style={{ minHeight: 3.4 * 36 }} accessible accessibilityRole="header" accessibilityLabel={text}>
      <Text size={34} weight="semibold" tracking={-0.025} lh={37} style={{ opacity: out ? 0 : 1 }}>
        {reduce ? text : text.slice(0, n)}
        {!reduce && <Text size={34} weight="semibold" lh={37} style={{ color: caret ? p.c.accent : "transparent" }}>|</Text>}
      </Text>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ width: "50%", paddingRight: 16, marginBottom: 32 }}>
      <Text size={36} weight="semibold" tracking={-0.025} lh={40} num>{value}</Text>
      <Text size={14} tone="muted" style={{ marginTop: 8 }}>{label}</Text>
    </View>
  );
}
const CountStat = ({ target, label, run, reduce, format = String }: { target: number; label: string; run: boolean; reduce: boolean; format?: (n: number) => string }) =>
  <Stat value={format(useCountUp(target, run, reduce))} label={label} />;

// Reviews the admins picked (up to ten). Swipe sideways.
function Reviews({ items, width }: { items: Review[]; width: number }) {
  const { p } = useTheme(); const [at, setAt] = useState(0); const [open, setOpen] = useState<string | null>(null);
  const card = Math.round(width * 0.84); const step = card + 16;
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setAt(Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step)))), [items.length, step]);
  return (
    <View accessibilityLabel="What students say" style={{ borderTopWidth: 1, borderTopColor: p.c.line, paddingVertical: 64 }}>
      <View style={{ paddingHorizontal: 24 }}>
        <Heading size={24} accessibilityRole="header">What students say</Heading>
        <Text tone="muted" style={{ marginTop: 8 }}>Honest reviews from people who took a class.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={step} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={32}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, gap: 16 }}>
        {items.map((r, i) => {
          const long = r.comment.length > 210; const full = open === r.id;
          return (
            <View key={r.id} accessible={false} accessibilityLabel={`${i + 1} of ${items.length}`}
              style={{ width: card, borderRadius: 24, backgroundColor: p.c.surface, padding: 24, justifyContent: "space-between", gap: 20, borderWidth: 1, borderColor: p.c.line }}>
              <View style={{ gap: 14 }}>
                <Stars value={r.rating} size={18} />
                <Text size={15.5} lh={25} numberOfLines={full ? undefined : 6}>{r.comment}</Text>
                {long && <Pressable accessibilityRole="button" onPress={() => setOpen(full ? null : r.id)} hitSlop={8}><Text size={14} weight="medium" tone="accent">{full ? "Show less" : "Read more"}</Text></Pressable>}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: p.c.line, paddingTop: 16 }}>
                <Avatar name={r.student_name} url={r.student_avatar} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size={14} weight="semibold" lh={18} numberOfLines={1}>{r.student_name}</Text>
                  <Text size={12} tone="muted" numberOfLines={1}>{r.course_title ? `${r.course_title} · ` : ""}{fmtWhen(r.created_at, { day: "numeric", month: "short", year: "numeric" })}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
      {items.length > 1 && (
        <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8 }}>
          {items.map((r, i) => <View key={r.id} style={{ height: 6, width: i === at ? 20 : 6, borderRadius: 3, backgroundColor: i === at ? p.c.accent : p.c.line }} />)}
        </View>
      )}
    </View>
  );
}

export default function Landing() {
  const { p } = useTheme(); const router = useRouter(); const insets = useSafeAreaInsets(); const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const statsQ = useRpc<Stats>("public_landing_stats", {}, { ttlMs: 10 * 60_000, tags: ["landing"] });
  const reviewsQ = useRpc<Review[]>("public_featured_reviews", {}, { ttlMs: 10 * 60_000, tags: ["landing"] });
  const reviews = useMemo(() => (reviewsQ.data ?? []).filter((x) => x.comment), [reviewsQ.data]);
  const st = statsQ.data ?? null;
  // The stats block fades in once the numbers are known (web: once loaded or failed) and counts up when it scrolls into view.
  const ready = !statsQ.loading;
  const [seen, setSeen] = useState(false); const gridY = useRef(0); const scrollY = useRef(0);
  const check = useCallback(() => { if (!seen && gridY.current > 0 && scrollY.current + height * 0.9 > gridY.current + 40) setSeen(true); }, [seen, height]);
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => { if (ready) Animated.timing(fade, { toValue: 1, duration: reduce ? 0 : 500, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, [ready, reduce, fade]);
  const run = ready && seen;

  return (
    <View style={{ flex: 1, backgroundColor: p.c.bg }}>
      <LinearGradient pointerEvents="none" colors={[p.a("accent", 0.14), "transparent"]} start={{ x: 0.15, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, height: height * 0.8 }} />
      <ScrollView showsVerticalScrollIndicator={false} scrollEventThrottle={64} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; check(); }}>
        <View style={{ minHeight: height, paddingTop: insets.top, paddingHorizontal: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><AppIcon size={36} /><Text weight="semibold" tracking={-0.025}>IQ Academy</Text></View>
            <Pressable accessibilityRole="link" onPress={() => router.push("/login")} hitSlop={10}><Text size={14} tone="muted">Sign in</Text></Pressable>
          </View>
          <View style={{ flex: 1, justifyContent: "center", paddingBottom: 96 }}>
            <Typewriter lines={LINES} reduce={reduce} />
            <View style={{ marginTop: 40, gap: 12 }}>
              <Button onPress={() => router.push({ pathname: "/login", params: { mode: "up" } })} style={{ height: 48, borderRadius: 24 }}>Create an account</Button>
              <Button variant="secondary" onPress={() => router.push("/login")} style={{ height: 48, borderRadius: 24 }}>Sign in</Button>
            </View>
          </View>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: p.c.line, paddingVertical: 96, paddingHorizontal: 24 }}>
          <Text size={24} weight="semibold" tracking={-0.025} lh={32}>IQ Academy is the educational wing of PromptIQ AI Agency, offering affordable training in AI skills.</Text>
          <Text tone="muted" style={{ marginTop: 24 }}>
            PromptIQ builds AI-powered apps, solutions, and media and entertainment. Since 2024, IQ Academy has trained people through online cohorts, tutorials, workshops, creator internships and one-on-one mentorship.
          </Text>
          <Animated.View onLayout={(e) => { gridY.current = e.nativeEvent.layout.y + 0; check(); }} style={{ marginTop: 64, flexDirection: "row", flexWrap: "wrap", opacity: fade }}>
            {st && <CountStat target={st.centres} run={run} reduce={reduce} label={st.centres === 1 ? "Physical training centre" : "Physical training centres"} />}
            {st && <CountStat target={st.courses} run={run} reduce={reduce} label={st.courses === 1 ? "AI skill taught" : "AI skills taught"} />}
            <CountStat target={BASE_TRAINED + (st?.paid ?? 0)} run={run} reduce={reduce} format={people} label="People trained" />
            <Stat value="2024" label="Building since" />
          </Animated.View>
        </View>

        {reviews.length > 0 && <Reviews items={reviews} width={Math.min(width, 640)} />}

        <View style={{ borderTopWidth: 1, borderTopColor: p.c.line, paddingVertical: 32, paddingHorizontal: 24, paddingBottom: 32 + insets.bottom }}>
          <Text size={14} tone="muted">© {fmtWhen(now(), { year: "numeric" })} IQ Academy</Text>
        </View>
      </ScrollView>
    </View>
  );
}
