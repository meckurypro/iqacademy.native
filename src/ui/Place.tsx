import { Text as RNText } from "react-native";
import { place, placeSub, type CentreLike } from "@/shared/web/centre";
import { fonts } from "@/theme/tokens";
import { Text, type TextTone } from "./Text";

/**
 * Student-facing centre label: the town leads in semibold and the facility name follows at 85% size (web: text-[0.85em]).
 * React Native has no `em`, so give the base `size`; colour comes from `tone`.
 * `townOnly` drops the facility name; `nameOnly` keeps the facility name but drops the street (staff lists).
 */
export default function Place({ centre, townOnly, nameOnly, size = 15, tone, numberOfLines }: { centre: CentreLike; townOnly?: boolean; nameOnly?: boolean; size?: number; tone?: TextTone; numberOfLines?: number }) {
  const sub = townOnly ? "" : nameOnly ? (place(centre) === centre.name ? "" : centre.name) : placeSub(centre);
  return (
    <Text size={size} tone={tone} numberOfLines={numberOfLines}>
      <RNText style={{ fontFamily: fonts.semibold }}>{place(centre)}</RNText>
      {sub ? <RNText style={{ fontSize: size * 0.85 }}>{` · ${sub}`}</RNText> : null}
    </Text>
  );
}
