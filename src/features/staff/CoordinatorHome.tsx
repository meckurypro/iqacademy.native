// Port of web pages/CoordinatorHome.tsx. The coordinator's door: invite QR, today's classes, and who is enrolled.
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/core/auth";
import { env } from "@/core/env";
import { ok } from "@/core/errors";
import { useQuery, useRpc } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar, Badge, Card, PageHeader, Section, Skeleton, Text } from "@/ui";
import ClassCountdown from "@/features/student/ClassCountdown";
import DoorToday from "./DoorToday";

type Student = { enrolment_id: string; full_name: string | null; avatar_url: string | null; pack: string | null; duration_weeks: number | null; status: string };
const APP_URL = env.webBaseUrl ?? "https://classes.promptiq.com.ng";

export function CoordinatorHome() {
  const { p } = useTheme(); const { roles, name } = useAuth();
  const centreId = roles.find((r) => r.role === "coordinator")?.centre_id ?? undefined;
  const cq = useQuery<{ name: string; address: string | null }>({ key: ["coordCentre", centreId], enabled: !!centreId, tags: ["centres"], ttlMs: 10 * 60_000, fn: async (sb) => ok(await sb.from("centres").select("name,address").eq("id", centreId!).single()) as { name: string; address: string | null } });
  const rq = useRpc<Student[]>("centre_students", { p_centre_id: centreId }, { enabled: !!centreId, tags: ["students", "enrolments"] });
  const centre = cq.data; const roster = rq.data?.filter((e) => e.status !== "completed");
  if (!centreId) return <PageHeader title={`Hi ${name.split(" ")[0]}`} sub="You're not assigned to a centre yet." />;
  if (!centre || !roster) return <View style={{ gap: 12 }}><Skeleton height={32} style={{ width: "66%" }} /><Skeleton height={160} /><Skeleton height={96} /></View>;
  return (
    <View style={{ gap: 24 }}>
      <PageHeader title={`Hi ${name.split(" ")[0]}`} sub={centre.name} />
      <ClassCountdown />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ borderRadius: 12, backgroundColor: "#fff", padding: 8 }}><QRCode value={APP_URL} size={96} backgroundColor="#fff" color="#000" /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">Invite students</Text><Text size={14} tone="muted">Let them scan this to open the app, create an account and enrol themselves.</Text></View>
      </Card>
      <DoorToday centreIds={[centreId]} />
      <Section title="Students" aside={<Text size={14} tone="muted" num>{roster.length}</Text>}>
        <View style={{ gap: 12 }}>{roster.map((e) => (
          <Card key={e.enrolment_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <Avatar name={e.full_name ?? "?"} url={e.avatar_url} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" numberOfLines={1}>{e.full_name}</Text><Text size={14} tone="muted" numberOfLines={1}>{e.pack}{e.duration_weeks ? ` · ${e.duration_weeks} weeks` : ""}</Text></View>
            <Badge tone={e.status === "active" ? "ok" : "warn"}>{e.status === "active" ? "Active" : "Unpaid"}</Badge>
          </Card>))}</View>
      </Section>
      <View style={{ height: 0, backgroundColor: p.c.bg }} />
    </View>
  );
}
