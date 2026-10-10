// Port of web pages/Manage.tsx. Grouped by what an admin is trying to do, so eleven rows read as three short lists.
import { View } from "react-native";
import { useQuery, useRpc } from "@/data";
import { Badge, List, NavRow, PageHeader, Section, type IconName, type Tone } from "@/ui";

type Item = [to: string, title: string, icon: IconName, hint: string, tone?: Tone];
const GROUPS: [title: string, items: Item[]][] = [
  ["Classes", [
    ["/schedule", "Schedule", "schedule", "Class days and course start and end dates", "info"],
    ["/roster", "Roster", "roster", "Who teaches which class", "info"],
    ["/custom", "Custom classes", "calendarPlus", "Create a class and choose who is invited", "info"],
    ["/courses", "Course builder", "courses", "Classes in each course and what they cover", "info"],
  ]],
  ["Money", [
    ["/prices", "Prices & instalments", "prices", "Package prices and instalment amounts", "ok"],
    ["/offline-payments", "Offline payments", "cash", "Cash and transfers waiting to be confirmed", "ok"],
    ["/payments", "Payments & refunds", "receipt", "Student payments and refunds", "ok"],
    ["/payouts", "Payouts", "payout", "Monthly payments to centres", "ok"],
  ]],
  ["People & places", [
    ["/centres", "Centres", "centres", "Locations, teams, revenue share, bank accounts"],
    ["/instructors", "Instructors", "instructor", "Classes and students taught"],
    ["/class-messages", "Class messages", "messages", "What instructors sent to classes"],
    ["/reviews", "Class reviews", "star", "What students said, reports, and the landing page"],
    ["/check-ins", "Hand check-ins", "lock", "Who checked in whom by hand, and disputes"],
  ]],
];

export default function Manage() {
  const oq = useRpc<{ open?: number }>("offline_payment_counts", {}, { tags: ["payments"], ttlMs: 60_000 });
  const rq = useQuery<number>({ key: ["reportedReviews"], tags: ["reviews"], ttlMs: 60_000, fn: async (sb) => (await sb.from("class_reviews").select("id", { count: "exact", head: true }).eq("report_instructor", true)).count ?? 0 });
  const dq = useQuery<number>({ key: ["disputedCheckIns"], tags: ["checkins"], ttlMs: 60_000, fn: async (sb) => (await sb.from("hand_check_ins").select("id", { count: "exact", head: true }).not("disputed_at", "is", null)).count ?? 0 });
  const open = oq.data?.open ?? 0, reports = rq.data ?? 0, disputes = dq.data ?? 0;
  return (
    <View style={{ gap: 28 }}>
      <PageHeader title="Manage" />
      {GROUPS.map(([title, items]) => (
        <Section key={title} title={title}>
          <List>{items.map(([to, t, icon, hint, tone]) => (
            <NavRow key={to} to={to} icon={icon} title={t} hint={hint} tone={tone}
              badge={to === "/offline-payments" && open > 0 ? <Badge tone="warn">{open} waiting</Badge> : to === "/reviews" && reports > 0 ? <Badge tone="bad">{reports} reported</Badge> : to === "/check-ins" && disputes > 0 ? <Badge tone="bad">{disputes} disputed</Badge> : undefined} />))}
          </List>
        </Section>))}
    </View>
  );
}
