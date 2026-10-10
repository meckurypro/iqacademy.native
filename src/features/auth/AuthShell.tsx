// src/features/auth/AuthShell.tsx
// The frame every signed-out screen shares: a centred column (web: mx-auto grid min-h-screen max-w-sm content-center gap-6 p-6) that scrolls when the keyboard is up.
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

export function AuthShell({ children, gap = 24 }: { children: ReactNode; gap?: number }) {
  const { p } = useTheme(); const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.c.bg }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <View style={{ width: "100%", maxWidth: 384, alignSelf: "center", gap }}>{children}</View>
    </ScrollView>
  );
}

export const AppIcon = ({ size = 56 }: { size?: number }) => (
  <Image source={require("../../../assets/images/icon-192.png")} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size * 0.28, alignSelf: "center" }} />
);
