// A page title whose subtitle can be a component (web: <h1> then a <p> holding <Place/>). PageHeader's `sub` is text only.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Heading, Text } from "@/ui";

export function PageTitle({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <View style={{ paddingTop: 4 }}>
      <Heading size={26} lh={32} numberOfLines={1}>{title}</Heading>
      {sub ? <View style={{ marginTop: 4 }}>{typeof sub === "string" ? <Text size={15} tone="muted">{sub}</Text> : sub}</View> : null}
    </View>
  );
}
