// ROUTE STUB (M5). Owner: M6. Web source: src/pages/Landing.tsx
// Replace the body with the real screen and keep the default export. Role guards live in port/route-manifest.json, not here.
// This screen is outside the signed-in shell: it has no header or tab bar, so do not use <Screen>.
import { Placeholder } from "@/shell/Placeholder";

export default function Route() {
  return <Placeholder module="M6" title="welcome" web="src/pages/Landing.tsx" plain />;
}
