# Decisions (ADRs)

Newest last. A decision marked **provisional** must be re-checked when its spike runs. Add a new ADR instead of rewriting an old one.

## ADR-001 Expo SDK 57, development builds only
Expo SDK 57 (RN 0.86, React 19.2, Hermes). **Expo Go cannot run this app**: SQLCipher is unsupported there (expo-sqlite docs) and push was removed from Expo Go in SDK 53. Use `eas build --profile development`. SDK-compatible versions come from `node_modules/expo/bundledNativeModules.json` (the sandbox that scaffolded this could not reach api.expo.dev, so `expo install` was replaced by installing those exact versions; on a normal machine run `npx expo install --check`).

## ADR-002 Styling: design tokens + StyleSheet, not NativeWind (**provisional**, spike S2)
NativeWind's stable release is 4.2.7 and 5.0 is only a release candidate; neither was proven on SDK 57 / RN 0.86 in this environment, and the web's `ring`, `divide-y`, `backdrop-blur`, arbitrary values and keyframes would each need a workaround. Primitives in `src/ui` hide the styling, so a later switch is local. Colours are **generated** from the web's `index.css` (`src/theme/tokens.generated.ts`), so palette changes cannot drift. Blur is **iOS only**; Android gets a solid translucent surface because blur is costly on low-end Android phones. Fonts: static Geist weights (Regular/Medium/SemiBold/Bold) through `useFonts`; no `fontWeight` is ever set.

## ADR-003 Auth flow: implicit by default, both parsed (**provisional**, spike S3)
`EXPO_PUBLIC_AUTH_FLOW=implicit` matches the web and keeps "open the email link on any device" true (the web's verify screen says so). PKCE is stricter but ties the link to the device that requested it. `core/authUrl.ts` handles both (`#access_token`, `?code`, error params), so switching is a config change. Supabase redirect allow-list must contain `iqacademy://auth/callback` (backend change B5).

## ADR-004 Data layer: cache by query, per-user SQLCipher file, memory fallback
- Screens never import the Supabase client (ESLint `no-restricted-imports`; allowed only in `src/core`, `src/data`, `src/dev`). They use `useQuery/useRpc/mutate` from `@/data`.
- Cache rows are query results (`rpc:name:args`), not a normalised mirror of 30 tables: the app is RPC/view driven with server-computed results.
- One encrypted file per user (`iqa-<sha256(uid)[:16]>.db`), key = 256 random bits in SecureStore with `AFTER_FIRST_UNLOCK` (readable by push/background handlers). `PRAGMA key` is the first statement. If the file cannot be opened it is deleted and recreated (it is a cache). If SQLCipher is unavailable the app **runs from memory** (`degraded`), it does not crash.
- Fresh data (younger than `ttlMs`, default 60 s, not invalidated) causes no network call: this matters for mobile data costs.
- Sign-out closes and **deletes** the user's DB. supabase-js 2.117 removes the local session even if the server call fails, so offline sign-out works (verified in node_modules).

## ADR-005 Offline policy: online-only unless listed
`src/data/policies.ts`. Queued today: `mark_notifications_read`, `mark_channel_read`. `send_class_message` is **not** queued until the server accepts a client idempotency key (B3), otherwise a retry after a lost response posts twice. Check-in, PIN, attendance, enrolment, payments and every admin save stay online-only because the server decides them.

## ADR-006 Connectivity = `isConnected` only
NetInfo's `isInternetReachable` probe URL can be blocked on some networks and would wrongly lock people out of online-only actions. Only an explicit "not connected" is offline; a request that really fails is handled where it fails.

## ADR-007 Routing
One expo-router `Tabs` navigator holds every signed-in route so the bottom bar is visible everywhere, like the web; the bar's buttons come from the role (`nav.generated.ts`). Signed-out landing is `/welcome` (web uses `/`, but `/` is the signed-in home here). `reset-password`, `verify-email` and `auth/callback` live at the root because the links sign people in first. Role guards are data (`port/route-manifest.json` → `guards.generated.ts`), checked in one place. Not ported: desktop sidebar/two-pane/`useDesktop` (D6, phone layout only).

## ADR-008 Time
`src/shared/web/time.ts` is generated from the web file and patched in one place: if the engine does not know `Africa/Lagos`, it shifts +1 h and formats as UTC (Lagos is UTC+1, no DST). Tests prove both strategies equal real Lagos data in Node. **S1 must still be run on Hermes** to see which strategy a device picks. `naira()` is hand-written (no `toLocaleString`).

## ADR-009 Generated vs hand-written
Files under `src/shared/web/`, `*.generated.ts(x)` are written by `scripts/sync-web.mjs` and must never be edited. The script fails loudly when a web file stops matching its patch. Hand-written partial ports carry a `PORT-OF` header.

## ADR-010 Intentional divergences from the web
`rolesReady` gate (no flash of student home); pull-to-refresh on `Screen` when a screen passes `onRefresh`; toasts live in the root view and are covered by an open sheet; haptics replace `navigator.vibrate`; FeedbackProvider keeps the web's `run/confirm/toast` API exactly. `expo-navigation-bar` is not installed: in SDK 57 it is declarative-only and the app is edge-to-edge, so the root view colour + `StatusBar` style do the web's "theme-coloured bars" job.

## ADR-011 One native baseline for every module
All planned native modules are installed and their permissions configured **now** (`port/NATIVE_DEPS.md`), so parallel sessions never each demand a new binary. Verified by offline `expo prebuild` for both platforms.

## Open (needs the owner)
- iOS bundle id / Android package default to `ng.com.promptiq.iqacademy` (from the web domain). Confirm or set `APP_BUNDLE_ID`.
- `EAS_PROJECT_ID`, Apple/Google accounts, APNs key, FCM v1 credentials.
- `WEB_HOST` (production web domain) for universal/app links and `EXPO_PUBLIC_WEB_BASE_URL`.
- Where Edge Function / base-schema source lives (D1).
