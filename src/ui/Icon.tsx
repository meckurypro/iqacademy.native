import { type StyleProp, type ViewStyle } from "react-native";
import Svg, { G } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { ICONS, type Layers } from "./icons.generated";

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName; size?: number;
  /** Filled form (the active tab). Icons with no body look the same either way. */
  solid?: boolean;
  /** Stroke/fill colour. Web used currentColor; here pass a colour (default: ink). */
  color?: string;
  /** What the details are cut out in when `solid`: the colour of whatever the icon sits on (default: surface). */
  cutColor?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Icon({ name, size = 22, solid = false, color, cutColor, style }: Props) {
  const { p } = useTheme();
  const ink = color ?? p.c.ink, cut = cutColor ?? p.c.surface;
  const l: Layers = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={style}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {l.body && <G fill={solid ? ink : "none"}>{l.body}</G>}
      {l.cut && <G stroke={solid ? cut : ink}>{l.cut}</G>}
      {l.dots && <G fill={solid ? cut : ink} stroke="none">{l.dots}</G>}
      {l.line && <G>{l.line}</G>}
    </Svg>
  );
}
