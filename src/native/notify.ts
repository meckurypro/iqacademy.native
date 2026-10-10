// Push notifications, device side (M11a, first part): permission, token, register/unregister with the backend (B1), foreground display.
// Local class reminders, tap routing and the app badge are not built yet.
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { kv } from "@/core/kv";
import { mutate, onBeforeSignOut, useOnline } from "@/data";
import { isExpoPushToken, pushState, registerArgs, type PushState } from "./pushArgs";

const projectId = (): string | undefined => (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
const tokenKey = (uid: string) => `push.token.${uid}`;

/** Call once at start: show notifications that arrive while the app is open, and create the Android channel. */
export async function setupNotifications() {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "IQ Academy", importance: Notifications.AndroidImportance.HIGH });
}

const permission = async () => (await Notifications.getPermissionsAsync()).status as "granted" | "denied" | "undetermined";

export async function currentPushState(uid: string): Promise<PushState> {
  return pushState({ permission: await permission(), hasProject: !!projectId() && Device.isDevice, registered: !!kv.get(tokenKey(uid)) });
}

/** Get this phone's push token and tell the backend. Safe to repeat (it just refreshes). Returns false when it cannot (no permission, no project id, offline). */
export async function registerPushToken(uid: string): Promise<boolean> {
  const id = projectId(); if (!id || !Device.isDevice) return false;
  if ((await permission()) !== "granted") return false;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  if (!isExpoPushToken(token)) return false;
  await mutate.rpc("register_push_token", registerArgs({ token, platform: Platform.OS, appVersion: Application.nativeApplicationVersion, deviceName: Device.deviceName }));
  kv.set(tokenKey(uid), token);
  return true;
}

/** The person taps "Turn on": ask the system once, then register. */
export async function enablePush(uid: string): Promise<PushState> {
  if ((await permission()) !== "granted") await Notifications.requestPermissionsAsync();
  await registerPushToken(uid);
  return currentPushState(uid);
}

/** Stop pushes to this phone (the token is removed on the server; the system permission is left alone). */
export async function disablePush(uid: string): Promise<void> {
  const t = kv.get(tokenKey(uid)); if (!t) return;
  await mutate.rpc("unregister_push_token", { p_token: t });
  kv.remove(tokenKey(uid));
}

/** Signed-in screens: quietly refresh the token if the person already allowed notifications, and forget this phone on sign-out. */
export function usePushRefresh(uid: string | undefined) {
  const online = useOnline();
  useEffect(() => { if (uid && online) registerPushToken(uid).catch((e) => console.warn("[push] refresh failed", e)); }, [uid, online]);
  useEffect(() => (uid ? onBeforeSignOut(() => disablePush(uid).catch(() => { /* offline: the server drops dead tokens by itself */ })) : undefined), [uid]);
}
