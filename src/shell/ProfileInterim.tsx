// INTERIM (M5), replaced by M13's Profile. The web moved sign-out and the theme switch from the drawer onto Profile (web 64bc5f7);
// until that screen is ported this keeps people able to sign out and change theme. Delete this file when M13 lands.
import { View } from "react-native";
import { primaryRole, roleLabel, useAuth } from "@/core/auth";
import { signOutAndWipe } from "@/data";
import { useThemePref, type ThemePref } from "@/theme/ThemeProvider";
import { Avatar, Badge, Button, Card, PageHeader, Section, Text, useFeedback } from "@/ui";

export function ProfileInterim() {
  const { name, avatar, roles, session } = useAuth(); const { run, confirm } = useFeedback(); const [pref, setPref] = useThemePref();
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
      <Button variant="danger" onPress={() => run("Signing out…", () => signOutAndWipe(confirm))}>Sign out</Button>
      <Text size={12} tone="muted" align="center">Temporary screen: the full Profile (photo, name, password, PIN) is module M13.</Text>
    </View>
  );
}
