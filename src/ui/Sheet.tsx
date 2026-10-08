// Bottom sheet (web: Sheet). Dark backdrop, rounded-t-3xl panel, handle, max 92% of the screen, scrolls, clears the home indicator.
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, shadow } from "@/theme/tokens";
import { BLUR } from "./ui";
import { Heading } from "./Text";
import { useExitMount } from "./useExitMount";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children?: ReactNode }) {
  const { p } = useTheme(); const insets = useSafeAreaInsets(); const { height } = useWindowDimensions();
  const mounted = useExitMount(open); // keep the Modal mounted while the exit animation plays
  if (!mounted) return null;
  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        {open && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
            <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,.5)" }]}>
              {BLUR && <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />}
            </Pressable>
          </Animated.View>
        )}
        {open && (
          <Animated.View accessibilityViewIsModal entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)}
            style={{ maxHeight: height * 0.92, backgroundColor: p.c.surface, borderTopLeftRadius: radius["3xl"], borderTopRightRadius: radius["3xl"], ...shadow.sheet }}>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom }}>
              <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: p.c.line, marginBottom: 16 }} />
              {title && <Heading size={20} lh={28} style={{ marginBottom: 16 }}>{title}</Heading>}
              {children}
            </ScrollView>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
