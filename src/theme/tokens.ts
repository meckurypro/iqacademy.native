// Design tokens. Colours come from the web's index.css via scripts/sync-web.mjs (tokens.generated.ts); radii, shadows and type match tailwind.config.js.
import { DARK, LIGHT, type RGB } from "./tokens.generated";

export type ColorName = "bg" | "surface" | "sunken" | "ink" | "muted" | "line" | "accent" | "accentInk" | "ok" | "warn" | "bad" | "info";
export type Scheme = "light" | "dark";
export type Tone = "ok" | "warn" | "bad" | "info" | "accent" | "muted";

const pick = (t: Record<string, RGB>): Record<ColorName, RGB> => ({
  bg: t.bg, surface: t.surface, sunken: t.sunken, ink: t.ink, muted: t.muted, line: t.line,
  accent: t.accent, accentInk: t["accent-ink"], ok: t.ok, warn: t.warn, bad: t.bad, info: t.info,
});
export const rgba = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

export type Palette = {
  scheme: Scheme;
  raw: Record<ColorName, RGB>;
  /** Solid colour strings, e.g. p.c.accent */
  c: Record<ColorName, string>;
  /** Tailwind-style alpha: p.a("accent", .1) is bg-accent/10 */
  a: (name: ColorName, alpha: number) => string;
};
const make = (scheme: Scheme): Palette => {
  const raw = pick(scheme === "dark" ? DARK : LIGHT);
  const c = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, rgba(v)])) as Record<ColorName, string>;
  return { scheme, raw, c, a: (n, alpha) => rgba(raw[n], alpha) };
};
export const PALETTES: Record<Scheme, Palette> = { light: make("light"), dark: make("dark") };

/** The page background in each theme as hex (web: THEME_COLOR). Used for the splash, root view and system bars. */
export const THEME_COLOR = { light: "#faf9f6", dark: "#0d0b08" } as const;

export const radius = { xl: 12, "2xl": 16, "3xl": 24, full: 999 } as const;

// tailwind: card 0 1px 2px /.03, 0 2px 8px /.03 ; lift 0 2px 4px /.04, 0 8px 24px /.08
export const shadow = {
  card: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  lift: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.09, shadowRadius: 24, elevation: 4 },
  sheet: { shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.18, shadowRadius: 32, elevation: 16 },
} as const;

/** Static Geist weights (variable fonts are uneven on React Native; spike S2). No fontWeight is ever set: the family IS the weight. */
export const fonts = { regular: "Geist-Regular", medium: "Geist-Medium", semibold: "Geist-SemiBold", bold: "Geist-Bold" } as const;
export type Weight = keyof typeof fonts;

/** Tailwind's line-heights for its named sizes; arbitrary text-[Npx] sizes inherit the body's 1.5. */
export const lineHeightFor = (size: number) => ({ 12: 16, 14: 20, 16: 24, 18: 28, 20: 28, 24: 32, 30: 36 } as Record<number, number>)[size] ?? Math.round(size * 1.5);
