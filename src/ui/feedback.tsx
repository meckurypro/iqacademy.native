// Port of web components/feedback.tsx. Same API:  run(label, fn, opts)  ·  confirm(opts)  ·  toast(msg, tone)
// Nothing in the app should change data without going through run().
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import Animated, { Easing, FadeIn, FadeInUp, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { friendly } from "@/core/errors";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, shadow } from "@/theme/tokens";
import { haptic } from "@/native/haptics";
import Icon from "./Icon";
import { Heading, Text } from "./Text";
import { BLUR, Button } from "./ui";

const MIN_VISIBLE_MS = 650; // even a very fast save stays on screen long enough to be seen

type ToastTone = "ok" | "bad";
type ToastItem = { id: number; msg: string; tone: ToastTone };
export type ConfirmOpts = { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
export type RunOpts = { success?: string; quiet?: boolean };
export type RunResult<T> = { ok: true; data: T } | { ok: false; error: unknown; message: string };

type Ctx = {
  /** Shows the overlay while `fn` runs. Never throws: check `.ok`. Errors toast unless `quiet` (use quiet when you show the error inline). */
  run: <T>(label: string, fn: () => Promise<T>, opts?: RunOpts) => Promise<RunResult<T>>;
  toast: (msg: string, tone?: ToastTone) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
};
const FeedbackCtx = createContext<Ctx | null>(null);
export const useFeedback = () => {
  const c = useContext(FeedbackCtx);
  if (!c) throw new Error("useFeedback needs <FeedbackProvider>");
  return c;
};

/** Full-screen "working" overlay: the app icon pulses and glows. Reduced motion: no scaling, a slow fade instead (never looks frozen). */
export function BusyOverlay({ label }: { label: string }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = reduce
      ? withRepeat(withSequence(withTiming(1, { duration: 1200 }), withTiming(0, { duration: 1200 })), -1)
      : withRepeat(withSequence(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) })), -1);
  }, [reduce, t]);
  const icon = useAnimatedStyle(() => (reduce ? { opacity: 0.6 + 0.4 * t.value } : { transform: [{ scale: 1 + 0.1 * t.value }], shadowOpacity: 0.45 * (0.6 + 0.4 * t.value) }));
  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={() => {}}>
      <Animated.View entering={FadeIn.duration(180)} accessibilityRole="progressbar" accessibilityLiveRegion="assertive" accessibilityLabel={label}
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,.65)", alignItems: "center", justifyContent: "center" }]}>
        {BLUR && <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />}
        <View style={{ alignItems: "center", gap: 28 }}>
          <Animated.View style={[{ width: 72, height: 72, borderRadius: 20, shadowColor: "rgb(255,197,107)", shadowOffset: { width: 0, height: 0 }, shadowRadius: 28, elevation: 12, backgroundColor: "#0d0b08" }, icon]}>
            <Image source={require("../../assets/images/icon-192.png")} style={{ width: 72, height: 72, borderRadius: 20 }} accessibilityIgnoresInvertColors />
          </Animated.View>
          <Text size={18} weight="medium" tracking={-0.025} style={{ color: "#fff" }}>{label}</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

function ConfirmDialog({ o, done }: { o: ConfirmOpts; done: (v: boolean) => void }) {
  const { p } = useTheme(); const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={() => done(false)}>
      <View style={{ flex: 1, justifyContent: "flex-end" }} accessibilityViewIsModal>
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,.55)" }]}>
          <View style={StyleSheet.absoluteFill} onTouchEnd={() => done(false)} />
        </Animated.View>
        <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} accessibilityRole="alert"
          style={{ backgroundColor: p.c.surface, borderTopLeftRadius: radius["3xl"], borderTopRightRadius: radius["3xl"], padding: 20, paddingBottom: 20 + insets.bottom, ...shadow.sheet }}>
          <Heading size={18} lh={28}>{o.title}</Heading>
          {o.message ? <View style={{ marginTop: 6 }}>{typeof o.message === "string" ? <Text size={15} tone="muted" lh={21}>{o.message}</Text> : o.message}</View> : null}
          <View style={{ marginTop: 20, flexDirection: "row", gap: 8 }}>
            {/* a destructive action is never the default choice: Cancel comes first and is the secondary-weight safe option */}
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => done(false)}>{o.cancelLabel ?? "Cancel"}</Button>
            <Button variant={o.danger ? "danger" : "primary"} style={{ flex: 1 }} onPress={() => done(true)}>{o.confirmLabel ?? "Confirm"}</Button>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { p } = useTheme(); const insets = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const [label, setLabel] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [ask, setAsk] = useState<{ o: ConfirmOpts; done: (v: boolean) => void } | null>(null);
  const jobs = useRef(new Map<number, string>());
  const seq = useRef(0); const shownAt = useRef(0);
  const pending = useRef<((v: boolean) => void) | null>(null);

  const toast = useCallback((msg: string, tone: ToastTone = "ok") => {
    const id = ++seq.current;
    if (tone === "bad") haptic.error();
    setToasts((t) => [...t.slice(-2), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 6000 : 2800);
  }, []);

  const run = useCallback(async <T,>(text: string, fn: () => Promise<T>, opts: RunOpts = {}): Promise<RunResult<T>> => {
    const id = ++seq.current;
    if (jobs.current.size === 0) shownAt.current = Date.now();
    jobs.current.set(id, text); setLabel(text);
    let res: RunResult<T>;
    try { res = { ok: true, data: await fn() }; }
    catch (error) { console.error(`[${text}]`, error); res = { ok: false, error, message: friendly(error) }; }
    if (jobs.current.size === 1) {
      const wait = MIN_VISIBLE_MS - (Date.now() - shownAt.current);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    jobs.current.delete(id);
    const rest = [...jobs.current.values()];
    setLabel(rest.length ? rest[rest.length - 1] : null);
    if (res.ok && opts.success) toast(opts.success, "ok");
    if (!res.ok && !opts.quiet) toast(res.message, "bad");
    return res;
  }, [toast]);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => {
    pending.current?.(false);
    const done = (v: boolean) => { pending.current = null; setAsk(null); resolve(v); };
    pending.current = resolve;
    setAsk({ o, done });
  }), []);

  const value = useMemo(() => ({ run, toast, confirm }), [run, toast, confirm]);
  return (
    <FeedbackCtx.Provider value={value}>
      {children}
      {ask && <ConfirmDialog o={ask.o} done={ask.done} />}
      {label !== null && <BusyOverlay label={label} />}
      {/* Toasts sit in the root view (a Modal would block touches for the whole toast). An open sheet covers them; they reappear when it closes. */}
      {toasts.length > 0 && (
        <View pointerEvents="box-none" accessibilityLiveRegion="polite" style={{ position: "absolute", left: 0, right: 0, top: 0, paddingTop: insets.top + 12, paddingHorizontal: 16, alignItems: "center", gap: 8, zIndex: 110, elevation: 110 }}>
          {toasts.map((t) => (
            <Animated.View key={t.id} entering={FadeInUp.duration(260)} exiting={FadeOut.duration(160)} accessibilityRole="alert"
              style={{ maxWidth: Math.min(384, width - 32), flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius["2xl"], paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1,
                backgroundColor: t.tone === "bad" ? p.c.bad : p.c.surface, borderColor: t.tone === "bad" ? p.c.bad : p.c.line, ...shadow.lift, shadowOpacity: 0.25 }}>
              {t.tone === "ok" && <Icon name="check" size={16} color={p.c.ok} />}
              <Text size={14} weight="medium" style={{ color: t.tone === "bad" ? "#fff" : p.c.ink, flexShrink: 1 }}>{t.msg}</Text>
            </Animated.View>
          ))}
        </View>
      )}
    </FeedbackCtx.Provider>
  );
}
