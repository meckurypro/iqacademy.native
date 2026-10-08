// Light / Dark / System, persisted, applied app-wide (Appearance override also themes native alerts and keyboards).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { kv } from "@/core/kv";
import { PALETTES, THEME_COLOR, type Palette, type Scheme } from "./tokens";

export type ThemePref = "light" | "dark" | "system";
const KEY = "theme"; // same key and values as the web app

const readPref = (): ThemePref => { const t = kv.get(KEY); return t === "light" || t === "dark" ? t : "system"; };

type Ctx = { pref: ThemePref; setPref: (p: ThemePref) => void; scheme: Scheme; p: Palette };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const system = useColorScheme();
  const scheme: Scheme = pref === "system" ? (system === "dark" ? "dark" : "light") : pref;

  useEffect(() => { Appearance.setColorScheme(pref === "system" ? "unspecified" : pref); }, [pref]);
  // The app draws edge to edge, so the root view's colour is what shows under the status/navigation bars and during transitions.
  useEffect(() => { SystemUI.setBackgroundColorAsync(THEME_COLOR[scheme]).catch(() => {}); }, [scheme]);

  const setPref = useCallback((p: ThemePref) => { if (p === "system") kv.remove(KEY); else kv.set(KEY, p); setPrefState(p); }, []);
  const value = useMemo<Ctx>(() => ({ pref, setPref, scheme, p: PALETTES[scheme] }), [pref, setPref, scheme]);
  return (
    <ThemeCtx.Provider value={value}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme needs <ThemeProvider>");
  return c;
}
/** Same tuple shape as the web's useTheme(): [pref, setPref]. */
export const useThemePref = (): [ThemePref, (p: ThemePref) => void] => { const { pref, setPref } = useTheme(); return [pref, setPref]; };
