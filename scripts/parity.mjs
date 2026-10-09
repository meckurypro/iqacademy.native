#!/usr/bin/env node
// scripts/parity.mjs — the parity ledger: every web source file → its native counterpart, owner module and status.
//   node scripts/parity.mjs                       add rows for any web file not yet in port/parity.json, then render port/PARITY.md
//   node scripts/parity.mjs set <web-file> --status ported --native src/features/x.tsx --sha 0081e66 [--note "…"]
// status: todo | wip | ported | stale (web changed after ported_from_sha) | diverged (intentionally different, see note) | skip (not applicable on phones)
// mode:   generated (scripts/sync-web.mjs writes it) | port (hand-ported) | new (native-only, no web file) | skip
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(process.env.WEB_REPO ?? join(root, "..", "iqacademy"));
const file = join(root, "port/parity.json");
const db = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { rows: [] };
const byWeb = new Map(db.rows.map((r) => [r.web, r]));

// owner module per web file (port/PLAN.md §7.2)
const OWN = {
  M0: ["src/main.tsx", "src/components/ErrorBoundary.tsx"],
  M2: ["src/components/ui.tsx", "src/components/feedback.tsx", "src/components/Icon.tsx", "src/components/Place.tsx", "src/components/Stars.tsx", "src/components/PinInput.tsx", "src/index.css", "src/lib/theme.ts"],
  M3: ["src/lib/supabase.ts", "src/lib/auth.tsx", "src/lib/db.ts", "src/lib/time.ts", "src/lib/password.ts", "src/lib/centre.ts", "src/lib/roster.ts", "src/lib/channels.ts", "src/lib/verify.ts", "src/components/ClockWatch.tsx"],
  M4a: ["src/lib/online.ts"],
  M5: ["src/App.tsx", "src/components/NavMenu.tsx", "src/lib/nav.ts", "src/components/MessagesRoute.tsx"],
  M6: ["src/pages/Landing.tsx", "src/pages/Login.tsx", "src/pages/VerifyEmail.tsx", "src/pages/ResetPassword.tsx", "src/components/PasswordFields.tsx"],
  M7a: ["src/pages/StudentHome.tsx", "src/components/QrScanner.tsx", "src/components/CheckInVerdict.tsx", "src/components/CourseOutline.tsx", "src/components/MakeupCard.tsx", "src/components/SoloCourses.tsx", "src/components/ClassCountdown.tsx", "src/components/PinGate.tsx", "src/components/ReviewSheet.tsx", "src/lib/checkin.ts", "src/lib/classClock.ts"],
  M7b: ["src/pages/Enrol.tsx", "src/pages/PayCallback.tsx", "src/pages/OfflinePay.tsx", "src/lib/payment.ts", "src/lib/offline.ts"],
  M8: ["src/pages/Messages.tsx", "src/pages/ClassChannel.tsx", "src/pages/InstructorMessages.tsx", "src/components/ClassComposer.tsx", "src/components/ChatBubble.tsx", "src/components/MessageBubble.tsx", "src/components/ChannelRow.tsx", "src/components/ShareToChats.tsx", "src/lib/messages.ts"],
  M9a: ["src/pages/InstructorHome.tsx", "src/pages/MyClasses.tsx", "src/pages/InstructorHistory.tsx", "src/pages/ClassScreen.tsx", "src/components/DoorPinSheet.tsx", "src/lib/doorLock.ts"],
  M9b: ["src/pages/CoordinatorHome.tsx", "src/pages/DirectorHome.tsx", "src/pages/StaffHome.tsx", "src/pages/Team.tsx", "src/pages/Schedule.tsx", "src/pages/CustomClasses.tsx", "src/components/CustomClassCard.tsx", "src/components/CustomClassSheet.tsx", "src/components/CustomClassStudents.tsx", "src/components/DoorToday.tsx", "src/components/RunReminder.tsx", "src/pages/Students.tsx", "src/pages/CentreClasses.tsx", "src/pages/Statement.tsx", "src/lib/useStaffCentres.ts"],
  M10a: ["src/pages/AdminHome.tsx", "src/pages/Users.tsx", "src/pages/Announce.tsx", "src/pages/Manage.tsx", "src/pages/Centres.tsx", "src/pages/Instructors.tsx", "src/pages/ClassReviews.tsx", "src/pages/HandCheckIns.tsx", "src/pages/ClassMessagesAdmin.tsx"],
  M10b: ["src/pages/Roster.tsx", "src/pages/CourseBuilder.tsx", "src/pages/Prices.tsx", "src/components/AssignSheet.tsx", "src/components/SoloPrices.tsx"],
  M10c: ["src/pages/Payments.tsx", "src/pages/OfflinePayments.tsx", "src/pages/Payouts.tsx"],
  M11a: ["src/pages/Notifications.tsx", "src/lib/notifications.ts"],
  M13: ["src/pages/Profile.tsx", "src/components/MyCentres.tsx"],
  skip: ["src/components/Sidebar.tsx", "src/lib/useMedia.ts"],
};
const GENERATED = { "src/lib/online.ts": null, "src/lib/time.ts": "src/shared/web/time.ts", "src/lib/centre.ts": "src/shared/web/centre.ts", "src/lib/roster.ts": "src/shared/web/roster.ts", "src/lib/channels.ts": "src/shared/web/channels.ts", "src/lib/db.ts": "src/shared/web/db.ts", "src/lib/password.ts": "src/shared/web/password.ts", "src/lib/supabase.ts": "src/shared/web/errors.ts (MESSAGES, friendly) + src/core/errors.ts", "src/components/Icon.tsx": "src/ui/icons.generated.tsx + src/ui/Icon.tsx", "src/index.css": "src/theme/tokens.generated.ts", "src/lib/nav.ts": "src/shell/nav.generated.ts" };
const owner = new Map(Object.entries(OWN).flatMap(([m, fs]) => fs.map((f) => [f, m])));

const args = process.argv.slice(2);
if (args[0] === "set") {
  const [, w] = args; const get = (k) => { const i = args.indexOf("--" + k); return i > 0 ? args[i + 1] : undefined; };
  const row = byWeb.get(w); if (!row) { console.error("no such row:", w); process.exit(1); }
  for (const k of ["status", "native", "sha", "note"]) { const v = get(k); if (v !== undefined) row[k === "sha" ? "ported_from_sha" : k] = v; }
  console.log("updated", w);
} else {
  const sha = execSync("git rev-parse --short HEAD", { cwd: web }).toString().trim();
  const list = (d) => readdirSync(join(web, d)).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => `${d}/${f}`);
  for (const f of [...list("src/pages"), ...list("src/components"), ...list("src/lib"), "src/App.tsx", "src/main.tsx", "src/index.css"]) {
    if (byWeb.has(f)) continue;
    const m = owner.get(f) ?? "unassigned", gen = GENERATED[f];
    const row = { web: f, module: m, mode: m === "skip" ? "skip" : gen ? "generated" : "port", native: gen ?? null, status: m === "skip" ? "skip" : gen ? "ported" : "todo", ported_from_sha: gen ? sha : null, note: m === "skip" ? "desktop-only / not used on phones" : "" };
    db.rows.push(row); byWeb.set(f, row);
  }
}
const syncSha = existsSync(join(root, "port/.web-sha")) ? readFileSync(join(root, "port/.web-sha"), "utf8").trim() : null;
if (syncSha) for (const r of db.rows) if (r.mode === "generated") r.ported_from_sha = syncSha; // sync-web regenerates these every run
db.rows.sort((a, b) => a.web.localeCompare(b.web));
writeFileSync(file, JSON.stringify(db, null, 2) + "\n");
const t = (r) => `| \`${r.web.replace("src/", "")}\` | ${r.module} | ${r.mode} | ${r.status} | ${r.native ? "`" + r.native + "`" : ""} | ${r.ported_from_sha ?? ""} | ${r.note ?? ""} |`;
const counts = db.rows.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
writeFileSync(join(root, "port/PARITY.md"), `# Parity ledger\n\nGenerated from \`port/parity.json\` by \`scripts/parity.mjs\`. Edit with \`node scripts/parity.mjs set <web-file> --status … --native … --sha …\`, never by hand.\n\n${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(" · ")}\n\n| web file | module | mode | status | native | ported from | note |\n|---|---|---|---|---|---|---|\n${db.rows.map(t).join("\n")}\n`);
console.log("parity:", JSON.stringify(counts), db.rows.some((r) => r.module === "unassigned") ? "UNASSIGNED ROWS EXIST" : "");
