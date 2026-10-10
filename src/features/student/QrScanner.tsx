// src/features/student/QrScanner.tsx
// Port of web components/QrScanner.tsx. The web used the browser's BarcodeDetector; native uses expo-camera's CameraView (QR only).
// Camera permission is asked just in time, with a clear "type the code instead" fallback when it is refused.
import { useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { haptic } from "@/native/haptics";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Text } from "@/ui";

export default function QrScanner({ onCode, onClose }: { onCode: (c: string) => void; onClose: () => void }) {
  const { p } = useTheme(); const [perm, ask] = useCameraPermissions(); const done = useRef(false); const [asked, setAsked] = useState(false);
  const note = (msg: string, action?: { label: string; onPress: () => void }) => (
    <View style={{ gap: 8 }}>
      <View style={{ borderRadius: 12, backgroundColor: p.c.sunken, padding: 16, gap: 12, alignItems: "center" }}>
        <Text size={14} tone="muted" align="center">{msg}</Text>
        {action && <Button variant="secondary" onPress={action.onPress}>{action.label}</Button>}
      </View>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text size={14} tone="muted">Cancel</Text></Pressable>
    </View>
  );
  if (!perm) return note("Starting the camera…");
  if (!perm.granted) {
    if (perm.canAskAgain || !asked) return note("Allow the camera to scan the class QR code, or type the code instead.", { label: "Allow camera", onPress: () => { setAsked(true); ask().catch(() => {}); } });
    return note("Camera access was blocked. Type the code instead, or turn the camera on for IQ Academy in your phone's settings.", { label: "Open settings", onPress: () => { Linking.openSettings().catch(() => {}); } });
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ overflow: "hidden", borderRadius: 16, backgroundColor: "#000", aspectRatio: 1 }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(r) => { if (done.current || !r.data) return; done.current = true; haptic.tap(); onCode(String(r.data)); }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 32, right: 32, top: 32, bottom: 32, borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,.8)" }} />
      </View>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text size={14} tone="muted">Cancel</Text></Pressable>
    </View>
  );
}
