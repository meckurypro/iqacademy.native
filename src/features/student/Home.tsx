// HOME STUB (M5). Owner: M7a. Web source: src/pages/StudentHome.tsx
// Replace the body with the real home screen and keep the named export. It renders inside the shell's <Screen>.
import { View } from "react-native";
import { Placeholder } from "@/shell/Placeholder";
import SoloCourses from "./SoloCourses";

export function StudentHome() {
  // The rest of the home (check-in, course outline, makeup card) is still to port; single courses are live.
  return <View style={{ gap: 16 }}><Placeholder module="M7a" title="Student Home" web="src/pages/StudentHome.tsx" bare /><SoloCourses /></View>;
}
