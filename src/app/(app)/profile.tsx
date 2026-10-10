// src/app/(app)/profile.tsx
// Profile and settings (web: src/pages/Profile.tsx). M13. Replaces the M5 interim screen.
import Profile from "@/features/profile/Profile";
import { Screen } from "@/shell/Screen";

export default function Route() {
  return <Screen><Profile /></Screen>;
}
