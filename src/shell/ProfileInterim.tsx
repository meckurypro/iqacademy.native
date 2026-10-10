// INTERIM (M5), replaced by M13's Profile. The web moved sign-out and the theme switch from the drawer onto Profile (web 64bc5f7);
// until that screen is ported this keeps people able to sign out and change theme. Delete this file when M13 lands.
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { primaryRole, roleLabel, useAuth } from "@/core/auth";
import { signOutAndWipe } from "@/data";
import { DELETE_WARNING, deleteMyAccount } from "@/features/profile/deleteAccount";
import { currentPushState, disablePush, enablePush } from "@/native/notify";
import type { PushState } from "@/native/pushArgs";
import { useThemePref, type ThemePref } from "@/theme/ThemeProvider";
import { Avatar, Badge, Button, Card, PageHeader, Section, Text, useFeedback } from "@/ui";

export function ProfileInterim() {
  const { name, avatar, roles, session } = useAuth(); const { run, confirm, toast } = useFeedback(); const [pref, setPref] = useThemePref();
  const uid = session?.user.id; const [push, setPush] = useState<PushState | null>(null);
  useEffect(() => { if (uid) currentPushState(uid).then(setPush).catch(() => setPush("unavailable")); }, [uid]);
  const togglePush = async () => {
    if (!uid) return;
    if (push === "on") { const r = await run("Turning off…", () => disablePush(uid), { success: "Notifications are off on this phone." }); if (r.ok) setPush(await currentPushState(uid)); return; }
    const r = await run("Turning on…", () => enablePush(uid));
    if (r.ok) { setPush(r.data); if (r.data !== "on") toast("Notifications weren't turned on. You can allow them in your phone's settings.", "bad"); }
  };
  const deleteAccount = async () => {
    if (!(await confirm({ title: "Delete your account?", message: DELETE_WARNING, confirmLabel: "Delete my account", danger: true }))) return;
    await run("Deleting your account…", deleteMyAccount);
  };
  return (
    <View style={{ gap: 24 }}>
      <PageHeader title="Profile" />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={name || "?"} url={avatar} size={52} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text weight="medium" numberOfLines={1}>{name}</Text>
          <Text size={13} tone="muted" numberOfLines={1}>{session?.user.email}</Text>
          <Badge>{roleLabel[primaryRole(roles)]}</Badge>
        </View>
      </Card>
      <Section title="Appearance">
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["light", "dark", "system"] as ThemePref[]).map((t) => <Button key={t} variant={pref === t ? "primary" : "secondary"} onPress={() => setPref(t)} style={{ flex: 1 }}>{t[0].toUpperCase() + t.slice(1)}</Button>)}
        </View>
      </Section>
      <Section title="Notifications">
        <Card style={{ gap: 10 }}>
          <Text size={14} tone="muted">{push === "on" ? "This phone gets class and payment updates as notifications." : push === "blocked" ? "Notifications are blocked for this app in your phone's settings." : push === "unavailable" ? "Notifications aren't available in this version of the app yet." : "Get class changes, reminders and payment updates on this phone."}</Text>
          {push === "blocked" ? <Button variant="secondary" onPress={() => Linking.openSettings()}>Open phone settings</Button> : push && push !== "unavailable" ? <Button variant={push === "on" ? "secondary" : "primary"} onPress={togglePush}>{push === "on" ? "Turn off on this phone" : "Turn on notifications"}</Button> : null}
        </Card>
      </Section>
      <Button variant="danger" onPress={() => run("Signing out…", () => signOutAndWipe(confirm))}>Sign out</Button>
      <Button variant="ghost" onPress={deleteAccount}>Delete my account</Button>
      <Text size={12} tone="muted" align="center">Temporary screen: the full Profile (photo, name, password, PIN) is module M13.</Text>
    </View>
  );
}
