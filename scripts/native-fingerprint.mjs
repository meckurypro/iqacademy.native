// scripts/native-fingerprint.mjs
// The CI gate for over-the-air updates (M14). With runtimeVersion policy "appVersion", an OTA update reaches EVERY build that has the same `version`.
// So if the native side changed (a package, a plugin, a permission, the scheme...) and `version` did not, the update would be sent to builds that cannot run it.
//
//   node scripts/native-fingerprint.mjs --check    exit 1 when the native fingerprint changed but `version` did not (use before publishing an update)
//   node scripts/native-fingerprint.mjs --accept   record the current fingerprint as the baseline (.eas/fingerprint.json); commit it with the version bump
//   node scripts/native-fingerprint.mjs --print    show the current fingerprint and version
//
// The fingerprint is computed in a fixed environment (production variant, no EAS project id) so it is the same on every machine and in CI.
// It tracks the repo's native surface, not any one EAS build's own fingerprint. If a change is not really native (for example an edit to eas.json, which
// the fingerprint counts), the check fails the same way: confirm it, then run --accept and say why in the PR.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SOURCE_SKIPS, SourceSkips, createFingerprintAsync } from "@expo/fingerprint";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(root, ".eas", "fingerprint.json");
const mode = process.argv[2] ?? "--check";

// A fixed environment, so app.config.ts evaluates the same everywhere.
process.env.APP_VARIANT = "production";
delete process.env.EAS_PROJECT_ID;
delete process.env.WEB_HOST;
delete process.env.APP_BUNDLE_ID;

function appVersion() {
  const out = execFileSync("npx", ["expo", "config", "--type", "public", "--json"], { cwd: root, encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "ignore"] });
  const v = JSON.parse(out.slice(out.indexOf("{"))).version;
  if (typeof v !== "string") throw new Error("app.config.ts has no version");
  return v;
}
const keyOf = (s) => `${s.type}:${s.id ?? s.filePath ?? s.contents?.slice(0, 40) ?? ""}`;
async function current() {
  // npm scripts are not native: editing them must not count as a native change.
  const fp = await createFingerprintAsync(root, { sourceSkips: DEFAULT_SOURCE_SKIPS | SourceSkips.PackageJsonScriptsAll });
  return { version: appVersion(), hash: fp.hash, sources: Object.fromEntries(fp.sources.map((s) => [keyOf(s), s.hash])) };
}

const now = await current();
if (mode === "--print") { console.log(JSON.stringify({ version: now.version, hash: now.hash }, null, 2)); process.exit(0); }
if (mode === "--accept") {
  writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
  console.log(`Baseline recorded: version ${now.version}, fingerprint ${now.hash.slice(0, 12)}…`);
  process.exit(0);
}
if (mode !== "--check") { console.error(`Unknown option ${mode}. Use --check, --accept or --print.`); process.exit(2); }

if (!existsSync(BASELINE)) { console.error("No baseline at .eas/fingerprint.json. Run: node scripts/native-fingerprint.mjs --accept"); process.exit(1); }
const base = JSON.parse(readFileSync(BASELINE, "utf8"));
if (base.hash === now.hash) { console.log(`OK: native fingerprint unchanged (version ${now.version}). A JS-only update is safe to publish.`); process.exit(0); }

const changed = [...new Set([...Object.keys(base.sources ?? {}), ...Object.keys(now.sources)])].filter((k) => base.sources?.[k] !== now.sources[k]);
console.log("Native fingerprint changed. Sources that differ:\n" + changed.map((k) => `  - ${k}`).join("\n"));
if (now.version === base.version) {
  console.error(`\nFAIL: the native side changed but "version" is still ${now.version}. An OTA update would reach builds that cannot run it.\n` +
    `  - If this needs a new binary: bump "version" in app.config.ts, run --accept, build and submit, and only then publish updates.\n` +
    `  - If it is not native (for example an eas.json edit): run --accept and explain why in the PR.`);
  process.exit(1);
}
console.log(`\nOK: "version" went from ${base.version} to ${now.version}, so updates for this version go only to the new build. Run --accept and commit the new baseline.`);
