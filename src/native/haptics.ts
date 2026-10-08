// Replaces navigator.vibrate (QrScanner 30 ms; CheckInVerdict 40 ms / 90-60-90). Never throws, never blocks.
import * as Haptics from "expo-haptics";

const safe = (p: Promise<void>) => { p.catch(() => {}); };
export const haptic = {
  tap: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => safe(Haptics.selectionAsync()),
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
