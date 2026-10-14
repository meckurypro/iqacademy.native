// The route manifest (port/route-manifest.json) is the single source of truth for routes and role guards.
// src/shell/guards.generated.ts is generated from it by `node scripts/routes.mjs`. A route added without regenerating once left /wallet
// open to every signed-in role in the native app (the data stayed protected server-side, but the guard was wrong): this test makes that impossible to miss.
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { GUARDS } from "@/shell/guards.generated";

const root = join(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "port/route-manifest.json"), "utf8")) as { routes: { web: string; file: string; guard?: string[] }[]; homes: { component: string }[] };

describe("route manifest", () => {
  it("guards.generated.ts matches the manifest exactly (run `node scripts/routes.mjs` if this fails)", () => {
    const expected = Object.fromEntries(manifest.routes.filter((r) => r.guard).map((r) => [r.web, r.guard]));
    expect(GUARDS).toEqual(expected);
  });
  it("every route in the manifest has a file under src/app", () => {
    const missing = manifest.routes.filter((r) => !existsSync(join(root, "src/app", r.file))).map((r) => r.file);
    expect(missing).toEqual([]);
  });
  it("every role home component exists", () => {
    const missing = manifest.homes.filter((h) => !existsSync(join(root, h.component))).map((h) => h.component);
    expect(missing).toEqual([]);
  });
  it("no two routes share a web path or a file", () => {
    const paths = manifest.routes.map((r) => r.web), files = manifest.routes.map((r) => r.file);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(files).size).toBe(files.length);
  });
  it("the wallet is instructor-only", () => { expect(GUARDS["/wallet"]).toEqual(["instructor"]); });
});
