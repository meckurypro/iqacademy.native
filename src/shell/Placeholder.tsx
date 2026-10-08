// What every unported route shows. Deleted route by route as modules land. Visible on purpose: a half-ported app should look half-ported, not broken.
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Badge, Card, PageHeader, Text } from "@/ui";
import { Screen } from "./Screen";

export function Placeholder({ module, title, web, bare, plain }: { module: string; title: string; web: string; /** inside an existing Screen (home stubs) */ bare?: boolean; /** outside the signed-in shell (no header/tab bar) */ plain?: boolean }) {
  const { p } = useTheme(); const insets = useSafeAreaInsets();
  const body = (
    <View style={{ gap: 16 }}>
      <PageHeader title={title || "Not ported yet"} />
      <Card style={{ gap: 8 }}>
        <Badge tone="warn">Not ported yet · {module}</Badge>
        <Text size={14} tone="muted">This screen is a placeholder created by the navigation shell (M5).</Text>
        <Text size={13} tone="muted">Web source: {web}</Text>
      </Card>
    </View>
  );
  if (plain) return <View style={{ flex: 1, backgroundColor: p.c.bg, paddingTop: insets.top + 24, paddingHorizontal: 16 }}>{body}</View>;
  return bare ? body : <Screen>{body}</Screen>;
}
