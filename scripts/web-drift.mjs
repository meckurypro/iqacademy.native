#!/usr/bin/env node
// scripts/web-drift.mjs — "what changed in the web app since the last time someone reviewed it, and who does it affect?"
//   node scripts/web-drift.mjs               fetch the web repo, compare against last_reviewed_web_sha in port/WEB_SYNC.md
//   node scripts/web-drift.mjs --since <sha> compare against a specific commit
//   --no-fetch   skip git fetch      --mark   set affected ledger rows to `stale`      --strict   exit 1 if anything is unmapped or stale (CI)
// Web checkout: $WEB_REPO or ../iqacademy.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(process.env.WEB_REPO ?? join(root, "..", "iqacademy"));
const A = process.argv.slice(2), has = (f) => A.includes(f);
const sh = (cmd) => execSync(cmd, { cwd: web, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
if (!existsSync(join(web, ".git"))) { console.error(`web checkout not found at ${web} (set WEB_REPO)`); process.exit(2); }

const syncFile = join(root, "port/WEB_SYNC.md");
const since = A.includes("--since") ? A[A.indexOf("--since") + 1] : readFileSync(syncFile, "utf8").match(/^last_reviewed_web_sha:\s*(\w+)/m)?.[1];
if (!since) { console.error("no last_reviewed_web_sha in port/WEB_SYNC.md"); process.exit(2); }
if (!has("--no-fetch")) { try { sh("git fetch origin --quiet"); } catch { console.warn("(fetch failed, using local refs)"); } }
const head = (() => { for (const r of ["origin/main", "origin/HEAD", "HEAD"]) { try { return sh(`git rev-parse --short ${r}`); } catch { /* next */ } } throw new Error("no ref"); })();
if (head === since) { console.log(`No web changes since ${since}.`); process.exit(0); }

const log = sh(`git log --format=%h\\ %s ${since}..${head}`).split("\n").filter(Boolean);
const changed = sh(`git diff --name-status ${since}..${head} -- src supabase README.md public package.json`).split("\n").filter(Boolean).map((l) => { const [s, ...f] = l.split("\t"); return { s: s[0], f: f[f.length - 1] }; });
const ledger = JSON.parse(readFileSync(join(root, "port/parity.json"), "utf8"));
const row = new Map(ledger.rows.map((r) => [r.web, r]));

const by = { mine: new Map(), unmapped: [], migrations: [], other: [] };
for (const { s, f } of changed) {
  if (f.startsWith("supabase/migrations/")) { by.migrations.push(`${s} ${f.split("/").pop()}`); continue; }
  const r = row.get(f);
  if (r) { if (!by.mine.has(r.module)) by.mine.set(r.module, []); by.mine.get(r.module).push({ s, f, r }); }
  else if (/^src\/(pages|components|lib)\//.test(f) || f === "src/App.tsx") by.unmapped.push(`${s} ${f}`);
  else by.other.push(`${s} ${f}`);
}

console.log(`Web moved ${since} → ${head}: ${log.length} commit(s), ${changed.length} file(s)\n`);
console.log(log.slice(0, 40).map((l) => "  " + l).join("\n") + (log.length > 40 ? `\n  … ${log.length - 40} more` : "") + "\n");
console.log("AFFECTED BY OWNER (port these, or add to that module's port/inbox/<module>.md):");
for (const [m, list] of [...by.mine].sort()) {
  console.log(`  ${m}`);
  for (const { s, f, r } of list) console.log(`    ${s} ${f.replace("src/", "")}  [${r.mode}/${r.status}]${r.mode === "generated" ? "  → run: npm run sync-web" : r.native ? `  → ${r.native}` : ""}`);
}
if (by.unmapped.length) console.log("\nUNMAPPED (new web files with no ledger row: run `node scripts/parity.mjs`, assign an owner in scripts/parity.mjs):\n" + by.unmapped.map((x) => "  " + x).join("\n"));
if (by.migrations.length) console.log("\nMIGRATIONS (check RPC/table shape changes → port/CONTRACTS.md; run `node scripts/gen-contracts.mjs`):\n" + by.migrations.map((x) => "  " + x).join("\n"));
if (by.other.length) console.log("\nOTHER:\n" + by.other.map((x) => "  " + x).join("\n"));

let routeDrift = false;
try { execSync("node scripts/routes.mjs --check", { cwd: root, stdio: "pipe", env: { ...process.env, WEB_REPO: web } }); }
catch (e) { routeDrift = true; console.log("\nROUTE DRIFT:\n" + String(e.stderr ?? e.stdout).split("\n").map((l) => "  " + l).join("\n")); }

if (has("--mark")) {
  let n = 0;
  for (const list of by.mine.values()) for (const { r } of list) if (["ported", "wip"].includes(r.status) && r.mode !== "generated") { r.status = "stale"; n++; }
  writeFileSync(join(root, "port/parity.json"), JSON.stringify(ledger, null, 2) + "\n"); console.log(`\nmarked ${n} ledger row(s) stale; run node scripts/parity.mjs to re-render PARITY.md`);
}
console.log(`\nWhen triage is written down, set last_reviewed_web_sha: ${head} in port/WEB_SYNC.md (only then).`);
if (has("--strict") && (by.unmapped.length || routeDrift || [...by.mine.values()].flat().some((x) => x.r.status === "stale"))) process.exit(1);
