// app.config.ts — single source for native config. Everything environment-specific comes from env vars (EAS env / .env.local).
// Changing anything under `plugins`, `ios`, `android`, `scheme` or `runtimeVersion` needs a NEW BINARY, not an OTA update.
import type { ConfigContext, ExpoConfig } from "expo/config";

const env = process.env;
type Variant = "development" | "preview" | "production";
const variant = (env.APP_VARIANT as Variant | undefined) ?? "production";
const suffix = variant === "production" ? "" : `.${variant}`;
// Default reverse-DNS comes from the web app's domain (promptiq.com.ng). Override per environment; confirm before the first store build.
const baseId = env.APP_BUNDLE_ID ?? "ng.com.promptiq.iqacademy";
const webHost = env.WEB_HOST; // e.g. the Vercel/custom domain; enables universal links + app links when set
const easProjectId = env.EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variant === "production" ? "IQ Academy" : `IQ Academy (${variant})`,
  slug: "iqacademy",
  scheme: "iqacademy",
  version: "1.0.0", // runtimeVersion follows this (policy: appVersion). Bump when the NATIVE surface changes.
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  runtimeVersion: { policy: "appVersion" },
  updates: easProjectId
    ? { url: `https://u.expo.dev/${easProjectId}`, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 }
    : { enabled: false },
  ios: {
    bundleIdentifier: `${baseId}${suffix}`,
    supportsTablet: false, // D6: phone layout only in v1
    associatedDomains: webHost ? [`applinks:${webHost}`] : undefined,
  },
  android: {
    package: `${baseId}${suffix}`,
    adaptiveIcon: { foregroundImage: "./assets/adaptive-foreground.png", backgroundColor: "#0d0b08" },
    softwareKeyboardLayoutMode: "resize",
    // The dev client asks for a draw-over-apps overlay; a store build must not (Play flags it). Dev/preview builds keep it for the dev menu.
    blockedPermissions: variant === "production" ? ["android.permission.SYSTEM_ALERT_WINDOW"] : undefined,
    predictiveBackGestureEnabled: false,
    intentFilters: webHost
      ? [{ action: "VIEW", autoVerify: true, data: [{ scheme: "https", host: webHost }], category: ["BROWSABLE", "DEFAULT"] }]
      : undefined,
  },
  plugins: [
    "expo-router",
    // SQLCipher: native change, needs a rebuilt binary, unsupported in Expo Go (docs, SDK 57).
    ["expo-sqlite", { useSQLCipher: true }],
    "expo-secure-store",
    // ---- Native baseline for ALL planned modules, installed once so parallel sessions never each demand a new binary (port/NATIVE_DEPS.md). ----
    // Permissions are just-in-time and explained in plain words. Microphone, background location, reminders and motion are switched OFF on purpose.
    ["expo-camera", { cameraPermission: "IQ Academy uses the camera to scan class check-in codes and to photograph payment receipts.", microphonePermission: false, recordAudioAndroid: false, barcodeScannerEnabled: true }],
    ["expo-image-picker", { photosPermission: "IQ Academy lets you choose a profile photo, a payment receipt or a class attachment from your photos.", cameraPermission: "IQ Academy uses the camera to take a profile photo or photograph a payment receipt.", microphonePermission: false }],
    ["expo-calendar", { calendarPermission: "IQ Academy adds your classes to your calendar when you ask it to.", remindersPermission: false }],
    ["expo-location", { locationWhenInUsePermission: "IQ Academy uses your location to fill in a centre's coordinates when an admin asks it to.", locationAlwaysAndWhenInUsePermission: false, locationAlwaysPermission: false, isAndroidBackgroundLocationEnabled: false, isIosBackgroundLocationEnabled: false, isAndroidForegroundServiceEnabled: false, motionUsagePermission: false }],
    ["expo-local-authentication", { faceIDPermission: "IQ Academy uses Face ID to unlock the app and to confirm sensitive admin actions." }],
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#a16207", defaultChannel: "default", mode: variant === "production" ? "production" : "development", enableBackgroundRemoteNotifications: false }],
    "expo-background-task",
    "expo-web-browser",
    [
      "expo-splash-screen",
      { image: "./assets/splash-icon.png", imageWidth: 160, backgroundColor: "#faf9f6", dark: { image: "./assets/splash-icon.png", backgroundColor: "#0d0b08" } },
    ],
  ],
  extra: { eas: easProjectId ? { projectId: easProjectId } : undefined, variant },
});
