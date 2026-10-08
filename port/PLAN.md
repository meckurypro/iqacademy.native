# IQ Academy → React Native (Expo) — Port Plan

Baseline audited: web `meckurypro/iqacademy` @ `0081e66` (65 commits, migrations 1–52, no file 31). Audit date: 2026‑10‑07.
Tags used below: **[verified]** checked against current docs/code today · **[inferred]** follows from the code, not tested · **[spike]** must be proven on a device before anyone builds on it.

---

## 1. What the web app actually is

| Fact | Count / detail |
|---|---|
| Screens / components / lib files | 38 pages · 33 components · 18 lib files (~7k dense lines TS/TSX) |
| Backend surface used by the client | **89 RPCs** · 30 tables/views · 5 Edge Functions · 3 storage buckets (`avatars`, `payment-receipts`, `class-messages`) |
| Realtime | `postgres_changes` on 6 tables: `notifications`, `user_roles`, `class_sessions`, `attendance`, `class_messages`, `checkin_denials` |
| Styling | Tailwind via CSS‑variable tokens, light/dark/system, **1,488 `className=`**, glass/blur, keyframe animations |
| Roles | student · instructor · coordinator · centre_director · admin · super_admin → 3 tab sets (student 2, instructor 5, admin 4); coordinator/director have no tab bar |
| Churn | 52 commits in 4 days at first look; **+5 commits and migrations 50–52 landed while this audit ran** |

Facts that shape the port:

1. **No server of our own.** Native talks to the same Supabase project. Zero backend rewrite, but any backend change is shared with web.
2. **Rules live in Postgres** (prices, eligibility, check‑in window, PIN, make‑up limits, withdrawals). Offline can therefore never mean "decide locally".
3. **Time is server‑corrected and always Lagos time** (`lib/time.ts`, `server_now()`, `fromWallInput`). Must be ported with golden tests, not re‑invented.
4. **Base schema + Edge Function source are not in this repo** (README: `iq-academy-db`). Native sessions cannot read them.
5. **New since first clone (affects native directly):** mandatory 4‑digit check‑in PIN after first payment (`PinGate`, `PinInput`, RPCs `pin_required/has_pin/set_pin/change_pin`), hand check‑in by registration number + PIN, admin Hand check‑ins page, class reviews + landing carousel, instructor share‑to‑chats, 2‑hour copy/share window on messages, theme‑coloured system bars, and a desktop sidebar layout (not for phones).
6. **Not in the web app today (native‑only additions):** push, device calendar, biometrics/app lock, offline cache, local reminders. Everything in §3 marked NEW is a product addition, not a port.

---

## 2. Stack (proposed)

| Concern | Web today | Native | Status |
|---|---|---|---|
| Runtime | React 18 + Vite | **Expo SDK 57 → RN 0.86, React 19.2** (released 2026‑06‑30). Pin to latest 57.x patch: 57.0.9+ fixed a Hermes V1 memory regression affecting Reanimated/worklets | [verified] |
| Dev workflow | browser | **Dev client builds from day one.** Expo Go is out: push was removed from Expo Go in SDK 53, and SQLCipher is a native config‑plugin change | [verified] push · [inferred] SQLCipher |
| Router | react-router 6 | expo-router (file routes mirror web routes 1:1) | — |
| Styling | Tailwind + CSS vars | NativeWind **or** token module + StyleSheet. Web uses `ring`, `divide-y`, `backdrop-blur`, `animate-*`, arbitrary values (`bottom-[calc(...)]`, `max-h-[92dvh]`) | [spike S2] |
| Icons | `Icon.tsx` (hand‑drawn SVG paths, solid/line forms) | react-native-svg, reuse the path data verbatim | [inferred] |
| QR show / scan | `qrcode.react` / `BarcodeDetector` | react-native-qrcode-svg (or own on react-native-svg) / `expo-camera` | [inferred] |
| Font | Geist Variable | static Geist weights via expo-font (variable fonts are uneven on RN) | [spike S2] |
| Local DB | none (no service worker, "does not work offline") | `expo-sqlite` with **`useSQLCipher: true`** plugin option | [verified] option exists in SDK 57 docs |
| Push | none (README: "Web Push isn't built yet") | `expo-notifications` + Expo Push Service; needs dev build, FCM v1 credentials, APNs key | [verified] |
| OTA | Vercel deploy | `expo-updates` / EAS Update. Docs default to `runtimeVersion: { policy: "appVersion" }`; docs call `fingerprint` experimental → use `appVersion` + a CI fingerprint check that blocks OTA when native surface changed | [verified] |
| Animations | CSS keyframes (`pop`, `rise`, `slide`, busy pulse) | react-native-reanimated | [inferred] |

Web is React 18, native is React 19.2 → **no shared UI code**. Only pure TypeScript is ever shared (copied, see §8).

---

## 3. Native capability & permission map

Rule for every row: ask **in context** (never at launch), build a denied‑state UI, declare it in `port/NATIVE_DEPS.md` (any new native module or permission = new binary, not OTA).

| # | Capability | Why (web evidence) | Package | iOS | Android | Module |
|---|---|---|---|---|---|---|
| 1 | **Camera – QR scan** | `QrScanner.tsx` (environment camera, `qr_code`) | expo-camera | `NSCameraUsageDescription` | `CAMERA` | M7a |
| 2 | **Photo / camera / file pick** | Avatar ≤2 MB jpg/png/webp (`Profile`); receipt ≤5 MB image/PDF with canvas resize to 1600px q.82 (`offline.ts`); any file ≤25 MB in class chat (`ClassComposer`) | expo-image-picker, expo-document-picker, expo-image-manipulator, expo-file-system | camera/photos strings | none for picker on Android 13+; `CAMERA` if shooting | M7b, M8, M13 |
| 3 | **Push notifications** | Reminders/announcements are rows in `notifications`; README says a push sender can be added without changing creation | expo-notifications | push entitlement, remote‑notification background mode | `POST_NOTIFICATIONS` (13+), FCM v1 | M11a |
| 4 | **Local scheduled alerts** | 60‑min "true reminders" for classes; works offline and without push | expo-notifications | — | avoid `SCHEDULE_EXACT_ALARM` (inexact is fine for a 60‑min lead) | M11a |
| 5 | **Calendar** (NEW) | Add my classes to device calendar, one‑way, opt‑in | expo-calendar | calendar usage strings (full or write‑only; confirm exact keys in docs) | `READ/WRITE_CALENDAR` | M11b |
| 6 | **Biometrics + device credential (PIN/pattern)** (NEW) | App lock, quick unlock of stored session, step‑up for admin money actions | expo-local-authentication | `NSFaceIDUsageDescription` | `USE_BIOMETRIC` | M12 |
| 7 | **Secure storage** | DB encryption key, session | expo-secure-store | Keychain | Keystore | M3/M4a |
| 8 | **Location (foreground only)** | Admin "Use my current location" for a centre (`Centres.tsx`) | expo-location | `WhenInUse` string | coarse/fine | M10a |
| 9 | **Haptics** | `navigator.vibrate` in scanner (30ms) and verdict (40 / 90‑60‑90) | expo-haptics | — | — | M2 |
| 10 | **Clipboard / Share** | Offline‑pay reference & account no.; message copy/share | expo-clipboard, RN Share / expo-sharing | — | — | M2/M8 |
| 11 | **Deep links / universal links** | Email confirm (`emailRedirectTo`), password reset, Paystack return, coordinator invite QR, push taps | expo-linking, scheme + associated domains / intent filters | associated domains | intent filters | M5/M6 |
| 12 | **In‑app browser** | Paystack checkout (`location.href = authorization_url`), inbox links, receipt PDFs | expo-web-browser (`openAuthSessionAsync`) | — | Custom Tabs | M7b |
| 13 | **Network state** | Offline banner, sync triggers | @react-native-community/netinfo | — | `ACCESS_NETWORK_STATE` | M4b |
| 14 | **Background work** | Best‑effort sync only, never for correctness | expo-background-task + expo-task-manager (confirm names in SDK 57) | background modes | — | M4b |
| 15 | **System bars** | Web 0081e66 paints status/nav bars to theme colour (`THEME_COLOR`) | expo-status-bar, expo-system-ui, expo-navigation-bar | — | — | M2 |
| 16 | Keep‑awake on door screen (NEW, optional) | Full‑screen class code at the door | expo-keep-awake | — | `WAKE_LOCK` | M9a |

**Explicitly not required** (do not add, store review friction): microphone, contacts, background location, Bluetooth, motion, photo‑library write.

**Biometrics ≠ the check‑in PIN.** The 4‑digit PIN is a server‑verified secret typed by the student so door staff can't check them in unseen. It stays exactly as web (M7a/M9a). Biometrics is a separate, local app‑lock layer (M12).

---

## 4. Offline / online + SQLite / SQLCipher

**Principle:** server is the authority. Offline = *read cache + a small set of safe queued writes*. Nothing offline decides eligibility, time windows, prices or money.

**Facade (the thing that prevents redundancy).** Screens never import `supabase`. They use one data layer (M4a/M4b):
`useRpc(name, args, { tags, ttl })` · `useTable(...)` · `mutate(name, args, { policy })` · `subscribe(tags)`.
A lint rule (`no-restricted-imports`) enforces it, so every ported screen gets caching, offline states and invalidation for free, and 94 raw `rpc()` call sites map mechanically.

**Local DB.** `expo-sqlite` + SQLCipher. One DB file per user id. Random 256‑bit key generated on first run, kept in SecureStore with *after‑first‑unlock* accessibility so push/background handlers can still read it. `PRAGMA key` must be the **first** statement after open **[verified: SQLCipher docs]**. Wipe the file on sign‑out, role switch and account deletion. Rotation via `PRAGMA rekey`.

**Schema (start small):** `kv` (clock skew, prefs) · `cache_entries(key, user_id, payload_json, tags, fetched_at, ttl)` · `outbox(id, op, args_json, idempotency_key, status, attempts, last_error, created_at)` · `blob_index(path, local_uri, size, fetched_at)`.
Cache by **query result**, not a normalised mirror of 30 tables. The app is RPC/view‑driven with server‑computed results; a normalised mirror would re‑implement server logic and drift. Normalise a table later only if a screen proves it needs it (e.g. message search).

**Freshness.** Stale‑while‑revalidate, "Updated x ago" + offline banner. Invalidate by tag on: realtime events (6 tables), app foreground, connectivity regained, own mutations.

**Sync matrix** (classified from RPC names/semantics **[inferred]** — M4b must confirm each by reading the SQL):

| Class | Policy | Members |
|---|---|---|
| **A. Cached reads** | SWR, per‑user | `my_roles`, `profiles`, student home bundle (`enrolments`, `v_student_progress`, `v_lesson_progress`), `v_session_details`, `my_class_clock`, `my_classes`, `my_class_channels`, `class_channel_messages`, notifications list, catalogue (centres, courses, packages, prices), `public_landing_stats`, `public_featured_reviews`, admin overviews (read‑only offline) |
| **B. Queued writes** | outbox, idempotent, visible "Pending (n)" | `mark_notifications_read`, `mark_channel_read`, `send_class_message` (needs client idempotency key, see B3), profile name/phone, avatar upload, receipt upload (`storage.upload` then `submit_offline_receipt`, with the web's compensating delete) |
| **C. Online‑only** | never queued; clear "needs internet" state | `check_in`, `set_pin/change_pin`, `mark_attendance` (hand check‑in), `dispute_hand_check_in`, `end_class_early`, enrolment + Paystack (`create_enrolment`, `create_solo_enrolment`, init/verify), offline‑payment request/approve/decline, refunds, payouts/withdrawals, every admin save (roster, course, price, centre, role, broadcast), custom‑class create/edit, reviews |

Conflicts: messages append‑only; profile last‑write‑wins; no merge UI. Poison ops stop after N attempts and surface to the user. Sign‑out with a non‑empty outbox asks first.

**Known limit [inferred]:** offline, "now" = last stored skew + monotonic delta; a user changing the phone clock offline could reopen the 2‑hour copy/share window. Server rules still hold. Acceptable, document it.

---

## 5. Backend changes the port needs (shared Supabase)

All of these land in the **web repo's `supabase/migrations/` (53+)** or the Edge Function source repo, reviewed by you. Native sessions must never create competing migrations.

| ID | Change | Why |
|---|---|---|
| B1 | `device_push_tokens` table + RLS + `register_push_token` / `unregister_push_token` | push |
| B2 | `send-push` Edge Function triggered by `notifications` INSERT; payload `{ route, data }`; skips `class_reminder*` if local reminders win (D5) | push |
| B3 | Idempotency key on `send_class_message` (and receipt submit) | safe offline retry |
| B4 | In‑app **account deletion** RPC/flow | Apple requires it for apps with sign‑up **[verify current guideline text]** |
| B5 | Auth redirect allow‑list: app scheme + universal‑link domain; decide PKCE vs implicit for native | email confirm / reset |
| ~~B6~~ | ~~Paystack return~~: **not needed**. Verified: init already returns `reference`, verify is idempotent (ADR-012) | payments |
| B7 | `app_settings.min_native_version` + RPC, force‑update screen | web/backend can change RPC contracts faster than users update (`check_in` was replaced 3 times) |

---

## 6. Translation rules (so sessions don't re‑decide)

| Web | Native |
|---|---|
| `supabase.rpc` in pages | `useRpc` / `mutate` |
| `run()` / `confirm()` / `toast()` (`feedback.tsx`) | **Same signatures** in RN (busy overlay, dialog, toast) so ports are mechanical |
| `friendly()` + `MESSAGES` map (changed 18+ times) | copied verbatim; highest‑drift file → first target for the sync script (§8) |
| `Sheet` (portal) / `createPortal` | one bottom‑sheet primitive in M2; RN Modal host |
| `<select>` (17 uses) | `SelectSheet` primitive |
| `datetime-local`, `type=date` | wall‑clock picker that reads/writes **Lagos time** through `fromWallInput`/`toWallInput` |
| `document.visibilityState`, `visibilitychange` | `AppState` |
| `localStorage` (`theme`, `iq:pending-verify`, `iq:resend-at:*`) | `kv` (SQLite) / SecureStore |
| `location.origin` | `WEB_BASE_URL` config |
| `navigator.vibrate` | expo‑haptics |
| `input type=file` | pickers (§3 #2) |
| `window.getSelection` guard in `ChatBubble` | `selectable` Text, disabled after the 2h window |
| `backdrop-blur`, `.glass` | expo‑blur [spike S2: Android perf] |
| `env(safe-area-inset-*)` | react-native-safe-area-context |
| `useDesktop`, `Sidebar`, two‑pane inbox | **not ported** (phone layout on tablets, D6) |
| Every `Intl`/`toLocale*` use | only via `time.ts` helpers (README rule; keep) |

---

## 7. Module plan

### 7.1 Order

```
Wave 0   M0 scaffold ──► M1 spikes (S1–S8)           M14 release pipeline starts here
Wave 1   M2 design system ║ M3 core services ║ M4a local DB + data hooks     (parallel)
Wave 2   M4b outbox/sync engine ║ M5 navigation shell + route stubs
Wave 3   M6 · M7a · M7b · M8 · M9a · M9b · M10a · M10b · M10c · M11a · M11b · M12 · M13   (parallel)
Always   M14 release engineering · M15 QA / parity / web‑drift sweep
```

### 7.2 Modules

Paths are **owned**: a session edits only its own paths. Everything else goes through that owner's inbox (`port/inbox/<module>.md`).

| ID | Module | Needs | Owns | Web sources |
|---|---|---|---|---|
| **M0** | Scaffold & control plane: Expo SDK 57 TS project, expo-router skeleton, `eas.json` (dev/preview/production profiles + channels), `runtimeVersion: appVersion`, env mapping `VITE_*`→`EXPO_PUBLIC_*`, lint/type/test CI, `port/*` files, `scripts/web-drift.mjs`, dev‑client builds | — | repo root, `port/**`, `scripts/**`, `app.config.ts` (hot) | `package.json`, `vite.config`, `.env.example`, `main.tsx`, `ErrorBoundary` |
| **M1** | Spikes S1–S8, each ends in an ADR in `port/DECISIONS.md` (§9) | M0 | `spikes/**`, `port/DECISIONS.md` | `time.ts`, `supabase.ts`, `auth.tsx`, `QrScanner`, `payment.ts` |
| **M2** | Design system: tokens (light/dark/system), fonts, `ui.tsx` primitives (Button, Card, Field, Sheet, Badge, Avatar, Skeleton, IconTile, NavRow, List, PageHeader, Section, Empty, Stat, Err, Stars, PinKeypad, Place), `Icon`, glass/blur, animations, system bars, haptics wrapper, **feedback system** (`run`/`confirm`/`toast`/BusyOverlay), `SelectSheet`, component gallery screen | M0, S2 | `src/ui/**`, `src/theme/**`, `assets/fonts/**` | `ui.tsx`, `feedback.tsx`, `Icon.tsx`, `Place.tsx`, `Stars.tsx`, `PinInput` (keypad part), `index.css`, `theme.ts`, `tailwind.config.js` |
| **M3** | Core services: Supabase client (RN storage, AppState auto‑refresh), `AuthProvider` + roles + realtime role updates, `friendly()`/`MESSAGES`/`naira`, **`time.ts` + clock sync + ClockNotice**, `db.ts` helpers, pure‑lib ports into `src/shared/` with tests (`password`, `centre`, `roster`, `channels`, `checkin` types/`doorState`, `classClock` pure fns, message types) | M0, S1, S3 | `src/core/**`, `src/shared/**` | `lib/{supabase,auth,db,time,password,centre,roster,channels,checkin,classClock,messages}`, `ClockWatch` |
| **M4a** | SQLCipher DB, key mgmt, per‑user files, wipe, local migrations runner, `cache_entries`, `useRpc`/`useTable`, tag invalidation, realtime→invalidate bridge, lint rule | M0, S4, S5, M3 | `src/data/db/**`, `src/data/query/**` | — (new) |
| **M4b** | Outbox + mutation policies (§4 matrix), backoff/retry, idempotency, NetInfo, foreground/reconnect triggers, background task, "Pending (n)" surface, sign‑out guard | M4a | `src/data/outbox/**`, `src/data/policies.ts` | — (new) |
| **M5** | Navigation shell: route stubs for **all** 38+ routes (each `export default Placeholder("<module>")`), role layouts + tab bars, header + bell + unread dot, right‑side drawer (`NavMenu`), role guards, signed‑out reset, verify redirect, deep‑link table, `route-manifest.md` | M2, M3 | `src/app/_layout*`, `src/app/(*)/_layout*`, `port/route-manifest.md` | `App.tsx`, `NavMenu`, `lib/nav.ts`, `MessagesRoute` |
| **M6** | Auth: Landing (rotating headlines, count‑up, reviews carousel), Login (in/up/forgot), VerifyEmail (+ inbox links, resend cooldown), ResetPassword, PasswordFields/Creator, deep‑link auth callbacks | M2, M3, M5, S3 | `src/features/auth/**` + its route files | `Landing`, `Login`, `VerifyEmail`, `ResetPassword`, `PasswordFields`, `lib/verify`, `lib/password` |
| **M7a** | Student home + check‑in: home bundle, CourseOutline, MakeupCard, SoloCourses, ClassCountdown + `useClassClock`/`useTicker`, check‑in sheet (code + QR scan), full‑screen verdict, `useCheckedIn`, **PinGate/PinSetup**, ReviewSheet | M2, M3, M4a, M5, S8 | `src/features/student/**`, `src/native/camera.ts` | `StudentHome`, `QrScanner`, `CheckInVerdict`, `CourseOutline`, `MakeupCard`, `SoloCourses`, `ClassCountdown`, `PinGate`, `PinInput`, `ReviewSheet`, `lib/checkin` (hook), `lib/classClock` (hooks) |
| **M7b** | Enrol (4 steps) + Paystack in‑app browser + PayCallback + OfflinePay + receipt capture/resize/upload | M2, M3, M4a/b, M5, S7 | `src/features/enrol/**` | `Enrol`, `PayCallback`, `OfflinePay`, `lib/payment`, `lib/offline` |
| **M8** | Class channels: student list, ClassChannel chat (paging, stick‑to‑bottom, mark read), InstructorMessages, composer (any file ≤25 MB), bubbles, copy/share + 2h window, ShareToChats, unread hook, admin ClassMessages | M2, M3, M4a/b, M5 | `src/features/channels/**` | `Messages`, `ClassChannel`, `InstructorMessages`, `ClassMessagesAdmin`, `ClassComposer`, `ChatBubble`, `MessageBubble`, `ChannelRow`, `ShareToChats`, `lib/messages` (hooks) |
| **M9a** | Instructor + live class screen: InstructorHome, MyClasses, InstructorHistory, **ClassScreen** (live roster, door code + QR, full‑screen door view, turned‑away list, hand check‑in with student PIN / admin override, end class with reason) | M2, M3, M4a, M5 | `src/features/class/**` | `InstructorHome`, `MyClasses`, `InstructorHistory`, `ClassScreen` |
| **M9b** | Coordinator/Director/Staff + Team, Schedule (class days, runs), CustomClasses (+Sheet/Students/Card), DoorToday, RunReminder, Director income + withdrawals | M2, M3, M4a, M5 | `src/features/staff/**` | `CoordinatorHome`, `DirectorHome`, `StaffHome`, `Team`, `Schedule`, `CustomClasses`, `CustomClass*`, `DoorToday`, `RunReminder` |
| **M10a** | Admin people & places: AdminHome, Users, Announce (audience builder), Manage hub, Centres (+bank verify, location), Instructors, ClassReviews, HandCheckIns | M2, M3, M4a, M5 | `src/features/admin-people/**` | `AdminHome`, `Users`, `Announce`, `Manage`, `Centres`, `Instructors`, `ClassReviews`, `HandCheckIns` |
| **M10b** | Admin classes & catalogue: Roster board + AssignSheet, CourseBuilder, Prices, SoloPrices | same | `src/features/admin-classes/**` | `Roster`, `AssignSheet`, `CourseBuilder`, `Prices`, `SoloPrices`, `lib/roster` (use) |
| **M10c** | Admin money: Payments & refunds, OfflinePayments (receipt viewer, approve/decline), Payouts | same + M12 step‑up | `src/features/admin-money/**` | `Payments`, `OfflinePayments`, `Payouts` |
| **M11a** | Notifications: list + bell/badge, push registration (B1), permission UX, Android channels, tap routing, foreground handler, app badge, **local class reminders** (dedupe vs push) | M3, M4a, M5, S6, B1–B2 | `src/features/notifications/**`, `src/native/notify.ts` | `Notifications`, `lib/notifications`, `Bell` in `App.tsx` |
| **M11b** | Calendar (opt‑in, one‑way): create/update/remove events from cached classes; events use absolute instants, titles in centre time | M11a, M4a | `src/features/calendar/**` | — (new) |
| **M12** | Device security: app lock on resume, quick unlock of stored session, step‑up auth for admin money actions, settings toggles; interaction with SQLCipher key (no per‑read biometric, so background handlers keep working) | M3, M4a | `src/features/security/**`, `src/native/biometrics.ts` | — (new) |
| **M13** | Profile & settings: Profile (avatar upload, name/phone, registration number), MyCentres, theme, change password, notification/lock/calendar toggles, update status, account deletion (B4), sign‑out | M2, M3, M4a, M5 | `src/features/profile/**` | `Profile`, `MyCentres` |
| **M14** | Release engineering: EAS credentials (APNs, FCM v1), channels `development/preview/production`, `appVersion` + CI fingerprint gate, in‑app update check/reload, rollout + rollback runbook, version scheme, `min_native_version` gate (B7), permission strings, store metadata, privacy/data‑safety, TestFlight + Play internal | M0 (starts), all (ends) | `eas.json`, `.eas/**`, `docs/release.md` | `vercel.json`, README "Deploying" |
| **M15** | QA + parity: golden tests for time/format, per‑screen web‑vs‑native screenshots (390px; iOS + low‑end Android), role test matrix, offline scenarios (airplane mode, kill app with outbox), a11y, **weekly web‑drift sweep** | M0, continuous | `tests/**`, `port/parity/**` | all |

Big sessions can split: M7a (check‑in vs home), M9a (class screen vs instructor lists), M10b (Roster vs CourseBuilder), M8 (chat vs lists).

### 7.3 Definition of done (every module)

1. Route files replace M5 stubs; no files edited outside owned paths (anything else → target module's inbox).
2. No direct `supabase` import (lint). Uses `src/ui` primitives; ad‑hoc styling only where no primitive exists.
3. Web conventions preserved: every write through `run()`, destructive actions through `confirm()`, errors through `friendly()`, no `new Date()`/`toLocale*` for anything shown.
4. Loading, empty, error **and offline** states; light + dark.
5. `port/PARITY.md` rows updated with `ported_from_sha`; screenshot pair added (web 390px vs iOS and Android).
6. Unit tests for pure logic; manual role‑matrix notes.
7. Any new native module/permission recorded in `port/NATIVE_DEPS.md` first.
8. PR names the web sha it was ported from and the result of `web-drift`.

### 7.4 Hot files (many sessions touch them)

`package.json`, `app.config.ts`, `eas.json`, `src/app/_layout.tsx`, `port/PARITY.md`, `port/route-manifest.md`. Rules: additive edits only, rebase right before PR, one PR per module, merge in DAG order, never reformat.

---

## 8. Staying in step with a web app that keeps changing

**Control plane in the native repo (`port/`):** `PLAN.md` (this, plus status) · `PARITY.md` (web file → native file → owner → `ported_from_sha` → status `todo/wip/ported/diverged`) · `WEB_SYNC.md` (`last_reviewed_web_sha` + log) · `CONTRACTS.md` (RPC/table/edge‑function shapes native depends on) · `DECISIONS.md` (ADRs) · `NATIVE_DEPS.md` · `inbox/<module>.md`.

**Every session starts with this (≈5 min):**
1. `git -C <web> fetch && git -C <web> log --stat <last_reviewed_sha>..origin/main -- src supabase README.md`
2. `scripts/web-drift.mjs` maps changed web files → owner modules via `PARITY.md` and marks rows `STALE`.
3. Triage each change: **mine** → port now · **someone else's** → append to their inbox, don't touch · **migration** → update `CONTRACTS.md`, flag M3/M4 if a shape changed · **new route** → add to `route-manifest.md` (M5 adds the stub) · **README convention** → `DECISIONS.md`.
4. Only then bump `last_reviewed_web_sha`.
5. Re‑run the drift check before opening the PR.

**Nightly CI** (M0/M14): runs the drift script and keeps one GitHub issue "Web drift: N files stale" current. M15 owns a weekly sweep so nothing rots unowned.

**Contract safety.** Old binaries talk to a backend the web team changes daily. Policy: RPC changes are additive, or ship with a `min_native_version` bump (B7). OTA fixes JS only for binaries on the same runtime, so a native‑surface change always needs a store build.

**Shared code.** Now: copy pure TS with the ledger (zero web‑repo changes). `MESSAGES` (18+ changes), `RULES`, `DENIED/REASON_LABEL` get a generated‑from‑web script in M3 so error wording can't drift silently. Later, if web settles: extract a shared `core` package (D9).

---

## 9. Spikes (M1) — prove before building

| ID | Question | Blocks |
|---|---|---|
| S1 | Does Hermes (SDK 57) honour `Intl.DateTimeFormat` with `timeZone:"Africa/Lagos"`, `formatToParts`, `hourCycle:"h23"`, `en-CA`, on iOS **and** Android? `time.ts` needs all four. Fallback: fixed +01:00 arithmetic checked against web golden fixtures | M3, everything time‑related |
| S2 | NativeWind on SDK 57 vs token+StyleSheet: can it do the web's `ring`, `divide-y`, arbitrary values, blur, animations at acceptable speed on a ≤3 GB Android? Static Geist weights ok? | M2 |
| S3 | Supabase auth in RN: session persistence (SecureStore size limits), PKCE + deep link round‑trip for confirm/reset, AppState auto‑refresh, replacing `location.hash` error parsing | M3, M6 |
| S4 | SQLCipher via config plugin in an EAS build: open, `PRAGMA key` first, key in SecureStore, wipe, open time | M4a |
| S5 | Realtime in RN: RLS‑filtered `postgres_changes`, drop on background, resubscribe + catch‑up on foreground | M4a |
| S6 | Push round trip on a physical device (Expo token → `notifications` row → delivery → tap routes); needs APNs key + FCM v1 | M11a |
| S7 | Paystack via `openAuthSessionAsync`: return path (bounce page vs `reference`), cancelled/failed states | M7b |
| S8 | Door‑condition QR scan reliability (low light, glare, torch) with expo-camera | M7a |

---

## 10. Decisions needed from you (default in bold)

| # | Decision | Default |
|---|---|---|
| D1 | ~~Where do base schema + Edge Function source live?~~ **Resolved:** Edge Functions live only in Supabase; schema is the live DB. New migrations go in the web repo's `supabase/migrations/` (53+) *and* are applied by the backend session; see `port/BACKEND.md` | resolved |
| D2 | Native repo name, iOS bundle id, Android package, EAS org, Apple/Google dev account status | needed |
| D3 | Offline check‑in | **Online‑only** (server decides window, entitlement, PIN) |
| D4 | Biometric scope | **App lock + quick unlock + step‑up on admin money actions, each toggleable** |
| D5 | Class reminders | **Local scheduled (works offline); server push for everything else** |
| D6 | Tablets | **Phone layout only in v1** |
| D7 | Styling | decided by spike S2 |
| D8 | Calendar | **Opt‑in, one‑way** |
| D9 | Shared code | **Copy + ledger now** |
| D10 | Approve backend additions B1–B7 | **Yes** |

---

## 11. Store/readiness checks (M14, verify against current policy text)

Account deletion in‑app (B4) · payment rules for in‑person tuition paid through an external gateway · Apple privacy manifest and Play data‑safety answers matching §3 · permission strings drafted per row · low‑end Android performance budget (Nigerian user base, Naira pricing) · version/`min_native_version` behaviour on forced update.


---

## Status (update this table when a module's PR merges)

| ID | Module | Status | Notes |
|---|---|---|---|
| M0 | Scaffold & control plane | **done** | Expo SDK 57, EAS profiles, CI, port/ files, sync + drift + parity + route + contract scripts; native baseline + permission audit |
| M1 | Spikes | **partial** | S1, S3 (storage half), S4 code written (`/dev/spikes`); **needs a device build to run**. S2 decided provisionally (ADR-002). S5–S8 need their modules (port/SPIKES.md) |
| M2 | Design system | **done** | tokens (generated), Geist, ui primitives, icons (generated), feedback, Sheet/SelectSheet, PinInput, gallery at `/dev/gallery`. Needs on-device visual review vs web |
| M3 | Core services | **done** | Supabase client, session/auth, clock, time (Hermes fallback), errors, pure libs. Partial ports: checkin, classClock, messages, offline (hooks left to M7a/M8/M9a) |
| M4a | Local DB + data hooks | **done** | SQLCipher per-user DB, cache, `useQuery/useRpc`, realtime bridge. Tested on real SQL (node:sqlite); **SQLCipher itself needs S4 on a device** |
| M4b | Outbox / sync engine | **done** | outbox, policies, `mutate`, backoff, sign-out guard. Queued today: `mark_notifications_read`, `mark_channel_read`. Background task not wired (foreground/reconnect triggers only) |
| M5 | Navigation shell | **done** | roles, tab bar, header, bell, drawer, guards, 34 route stubs, auth callback, route manifest |
| M6–M13 | Features | todo | stubs render "Not ported yet" |
| M14 | Release engineering | todo | pipeline config exists (eas.json); credentials, channels, OTA runbook, store work remain |
| M15 | QA / parity | todo | 44 unit tests exist; no device tests yet |
