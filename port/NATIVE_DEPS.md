# Native baseline and permission audit

**Rule:** any new native module, plugin option or permission means a **new binary** (EAS Build), not an OTA update. Add it here first. The set below is installed up front for all planned modules (ADR-011).

## Packages (SDK 57 pins from bundledNativeModules.json)
| Module owner | Packages |
|---|---|
| M0/M3/M4 | expo-router, expo-sqlite (`useSQLCipher`), expo-secure-store, expo-crypto, expo-updates, expo-dev-client, expo-constants, expo-linking, expo-application, @react-native-community/netinfo |
| M2/M5 | react-native-reanimated + worklets, gesture-handler, screens, safe-area-context, svg, expo-blur, expo-linear-gradient, expo-image, expo-font, expo-splash-screen, expo-system-ui, expo-haptics, expo-clipboard |
| M7a | expo-camera (QR, barcodeScanner on) |
| M7b/M8/M13 | expo-image-picker, expo-document-picker, expo-image-manipulator, expo-file-system, expo-web-browser (Paystack), expo-sharing |
| M9a | expo-keep-awake |
| M10a | expo-location (foreground only) |
| M11a | expo-notifications, expo-device |
| M11b | expo-calendar |
| M12 | expo-local-authentication |
| M4b | expo-background-task, expo-task-manager (iOS: best effort, never relied on) |

## Permission audit (from `expo prebuild`, production variant)
**Android:** CAMERA · ACCESS_COARSE/FINE_LOCATION (foreground) · READ/WRITE_CALENDAR · USE_BIOMETRIC (+ legacy USE_FINGERPRINT) · VIBRATE · INTERNET · READ/WRITE_EXTERNAL_STORAGE capped at **maxSdkVersion 32** (old Android only). `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` are **removed**. POST_NOTIFICATIONS / RECEIVE_BOOT_COMPLETED are added by expo-notifications at manifest merge (Gradle).
**iOS:** NSCameraUsageDescription · NSPhotoLibraryUsageDescription · NSLocationWhenInUseUsageDescription · NSCalendarsFullAccess/NSCalendarsUsageDescription · NSFaceIDUsageDescription · push entitlement (`aps-environment`) · UIBackgroundModes `fetch`,`processing` (no `remote-notification`, no audio, no location) · BGTaskSchedulerPermittedIdentifiers for background-task.
**Deliberately off:** microphone, background location, always-location strings, reminders, motion, contacts, Bluetooth.
**To review in M14:** dev-launcher's `NSLocalNetworkUsageDescription`/`NSBonjourServices` also appear in the production plist; confirm they are stripped from release archives or remove them. SQLCipher is encryption: complete the export-compliance questions (`ITSAppUsesNonExemptEncryption`) before TestFlight.

## OTA vs new build
OTA (EAS Update, JS/assets only): screens, copy, styles, logic, query/policy changes, new routes. New build: anything in the table above, `app.config.ts` plugins/permissions/scheme/icons/splash, SDK upgrades, `runtimeVersion` (`appVersion` policy: bump `version` in app.config.ts when the native surface changes).
