import { useFonts } from "expo-font";

/** Loads the four Geist weights. A font error must never block the app (it falls back to the system font), so `ready` is true on error too. */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    "Geist-Regular": require("../../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../../assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("../../assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("../../assets/fonts/Geist-Bold.ttf"),
  });
  return loaded || !!error;
}
