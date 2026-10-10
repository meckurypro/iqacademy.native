// Port of web pages/StaffHome.tsx: the fallback home for a signed-in user whose role has no dashboard.
import { primaryRole, roleLabel, useAuth } from "@/core/auth";
import { Card, Heading, Text } from "@/ui";

export function StaffHome() {
  const { name, roles } = useAuth(); const role = primaryRole(roles);
  return (
    <Card style={{ gap: 4, padding: 24 }}>
      <Heading size={20}>Hi {name.split(" ")[0]}</Heading>
      <Text tone="muted">{"You're signed in as "}<Text weight="semibold">{roleLabel[role]}</Text>{". Your dashboard is being built next."}</Text>
    </Card>
  );
}
