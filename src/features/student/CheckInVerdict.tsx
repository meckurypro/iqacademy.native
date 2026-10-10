// src/features/student/CheckInVerdict.tsx
// Port of web components/CheckInVerdict.tsx: the full-screen answer after a student checks in, green "go in" or red "stop at the desk".
// Colours are fixed (not theme tokens) so the answer reads the same in light and dark mode, from across a room.
import { useEffect } from "react";
import { Modal, Pressable, StatusBar, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useRouter, type Href } from "expo-router";
import { haptic } from "@/native/haptics";
import { deniedText, type Verdict } from "@/shared/checkin";
import { Icon, Text } from "@/ui";

export default function CheckInVerdict({ v, onDone, onRetry }: { v: Verdict; onDone: () => void; onRetry: () => void }) {
  const router = useRouter();
  useEffect(() => { if (v.ok) haptic.success(); else haptic.error(); }, [v]);
  const name = v.first_name ? `, ${v.first_name}` : "";
  const d = deniedText(v.reason);
  const title = v.ok
    ? (v.already_checked_in ? `Already in${name}` : v.makeup ? `Make-up class${name}` : v.emergency ? `Custom class${name}` : `You're in${name}!`)
    : `${d.title}${v.reason === "not_enrolled" || v.reason === "not_invited" || v.reason === "payment_required" ? name : ""}`;
  const sub = v.ok ? (v.already_checked_in ? "You're already marked present. Go on in." : "You're cleared for this class. Go on in!") : d.detail;
  const white = { color: "#fff" };
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <StatusBar barStyle="light-content" />
      <View accessibilityViewIsModal accessibilityLiveRegion="assertive" accessibilityLabel={v.ok ? "Checked in" : "Check-in refused"}
        style={{ flex: 1, backgroundColor: v.ok ? "#15803d" : "#b91c1c", alignItems: "center", justifyContent: "center", gap: 24, paddingHorizontal: 32 }}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: "rgba(255,255,255,.2)", alignItems: "center", justifyContent: "center" }}>
          <Icon name={v.ok ? "check" : "close"} size={64} color="#fff" />
        </Animated.View>
        <View style={{ gap: 8, alignItems: "center" }}>
          <Text size={36} weight="bold" tracking={-0.025} lh={40} align="center" style={white}>{title}</Text>
          <Text size={18} align="center" style={[white, { opacity: 0.95 }]}>{sub}</Text>
          {!!(v.course_title || v.centre_name) && <Text size={14} align="center" style={[white, { opacity: 0.85, paddingTop: 8 }]}>{[v.course_title, v.lesson_title, v.centre_name].filter(Boolean).join(" · ")}</Text>}
          {v.ok && <Text size={14} align="center" style={[white, { opacity: 0.85 }]}>Messages from your instructor will appear in Messages.</Text>}
          {!v.ok && <Text size={14} align="center" style={[white, { opacity: 0.85 }]}>See the front desk if you think this is a mistake.</Text>}
        </View>
        <View style={{ width: "100%", maxWidth: 320, gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={onDone} style={({ pressed }) => ({ height: 48, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <Text size={16} weight="semibold" style={{ color: "#000" }}>{v.ok ? "Done" : "Close"}</Text>
          </Pressable>
          {v.ok && !!v.session_id && (
            <Pressable accessibilityRole="link" onPress={() => { onDone(); router.push(`/messages/${v.session_id}` as Href); }} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
              <Text size={14} weight="medium" style={[white, { textDecorationLine: "underline" }]}>Open class messages</Text>
            </Pressable>
          )}
          {!v.ok && (
            <Pressable accessibilityRole="button" onPress={onRetry} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
              <Text size={14} weight="medium" style={[white, { textDecorationLine: "underline" }]}>Try another code</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
