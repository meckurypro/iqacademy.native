// src/features/student/CourseOutline.tsx
// Port of web components/CourseOutline.tsx: what a new student sees first: what they'll learn, what it costs, then the way in.
import { View } from "react-native";
import { useRouter } from "expo-router";
import { naira, ok } from "@/core/errors";
import { useQuery } from "@/data";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Card, Heading, Skeleton, Text } from "@/ui";

type Course = { id: string; title: string; summary: string | null };
type Pack = { id: string; name: string; course_count: number; price_full: number };

export default function CourseOutline() {
  const { p } = useTheme(); const router = useRouter();
  const courses = useQuery<Course[]>({ key: ["courses-active"], tags: ["courses"], ttlMs: 10 * 60_000, fn: async (sb) => (ok(await sb.from("courses").select("id,title,summary").eq("is_active", true).order("sort_order")) as Course[]) ?? [] });
  const packs = useQuery<Pack[]>({ key: ["packages-active"], tags: ["courses"], ttlMs: 10 * 60_000, fn: async (sb) => (ok(await sb.from("packages").select("id,name,course_count,price_full").eq("is_active", true).order("sort_order")) as Pack[]) ?? [] });
  const cta = <Button onPress={() => router.push("/enrol")}>Enrol now</Button>;
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 4 }}>
        <Heading size={20} lh={28}>{"What you'll learn"}</Heading>
        <Text tone="muted">Take one course or bundle them. Classes are in person.</Text>
      </View>
      {cta}
      <View style={{ gap: 8 }}>
        {courses.data === undefined ? <><Skeleton height={64} /><Skeleton height={64} /></> : courses.data.map((c, i) => (
          <Card key={c.id} style={{ flexDirection: "row", gap: 12, paddingVertical: 12 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: p.a("accent", 0.1), alignItems: "center", justifyContent: "center" }}><Text size={14} weight="semibold" tone="accent" num>{i + 1}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{c.title}</Text>{!!c.summary && <Text size={14} tone="muted" style={{ marginTop: 2 }}>{c.summary}</Text>}</View>
          </Card>
        ))}
      </View>
      {!!packs.data?.length && (
        <View style={{ gap: 8 }}>
          <Heading size={18} lh={28}>Packs</Heading>
          <Card style={{ paddingVertical: 4 }}>
            {packs.data.map((k, i) => (
              <View key={k.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: p.c.line }}>
                <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium">{k.name}</Text><Text size={14} tone="muted">{k.course_count} {k.course_count === 1 ? "course" : "courses"}</Text></View>
                <Text weight="medium" num>{naira(k.price_full)}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}
      <Card style={{ gap: 4 }}>
        <Text weight="medium">Pick a location</Text>
        <Text size={14} tone="muted">We teach at several locations. Choose the one closest and most convenient for you.</Text>
      </Card>
      {cta}
    </View>
  );
}
