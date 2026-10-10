// The frame for a conversation: header strip, a message list that sticks to the newest message (unless the reader scrolled up), and a composer
// pinned above the keyboard. Screen is for pages that scroll as a whole; a chat needs its own scroll control, so it has its own frame.
import { useEffect, useRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Header } from "./Screen";

export function ChatFrame({ top, children, footer, scrollKey }: { top?: ReactNode; children?: ReactNode; footer?: ReactNode; /** change this when new messages arrive */ scrollKey?: unknown }) {
  const { p } = useTheme(); const insets = useSafeAreaInsets();
  const ref = useRef<ScrollView>(null); const stick = useRef(true);
  useEffect(() => { if (stick.current) ref.current?.scrollToEnd({ animated: true }); }, [scrollKey]);
  return (
    <View style={{ flex: 1, backgroundColor: p.c.bg, paddingTop: insets.top }}>
      <Header />
      {top}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={ref} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEventThrottle={64}
          onScroll={(e) => { const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent; stick.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120; }}
          onContentSizeChange={() => { if (stick.current) ref.current?.scrollToEnd({ animated: false }); }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, maxWidth: 672, width: "100%", alignSelf: "center" }}>
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
}
