import type { ReactNode } from "react";
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts, lineHeightFor, type ColorName, type Tone, type Weight } from "@/theme/tokens";

export type TextTone = ColorName | Tone;
type P = Omit<TextProps, "style"> & {
  size?: number; weight?: Weight; tone?: TextTone; lh?: number; /** letter-spacing in em, e.g. -0.025 = tailwind tracking-tight */ tracking?: number;
  num?: boolean; upper?: boolean; align?: TextStyle["textAlign"]; style?: StyleProp<TextStyle>; children?: ReactNode;
};

/** The app's one text component: Geist, themed colour, Tailwind-equivalent line heights. Sizes are in px like the web classes. */
export function Text({ size = 16, weight = "regular", tone = "ink", lh, tracking, num, upper, align, style, children, ...rest }: P) {
  const { p } = useTheme();
  return (
    <RNText {...rest} allowFontScaling={rest.allowFontScaling ?? true} maxFontSizeMultiplier={rest.maxFontSizeMultiplier ?? 1.3}
      style={[{ fontFamily: fonts[weight], fontSize: size, lineHeight: lh ?? lineHeightFor(size), color: p.c[tone as ColorName] ?? p.c.ink },
        tracking != null && { letterSpacing: tracking * size }, num && { fontVariant: ["tabular-nums"] }, upper && { textTransform: "uppercase" }, align && { textAlign: align }, style]}>
      {children}
    </RNText>
  );
}

/** h1/h2/h3 in the web: font-semibold tracking-tight. */
export const Heading = ({ size = 24, ...p }: P) => <Text size={size} weight="semibold" tracking={-0.025} lh={size * 1.25} {...p} />;
