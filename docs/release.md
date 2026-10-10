<!-- docs/release.md -->
# Releasing IQ Academy (native)

Commands marked **(verified)** were checked against the current Expo docs on 2026-10-10. Anything marked **(unverified)** must be checked with `eas <command> --help` before first use.

## 0. What only the owner can provide
These block the first store build. Nothing here can be invented.

| Needed | Why | Status |
|---|---|---|
| Expo account + organisation, then `eas init` → **EAS_PROJECT_ID** | links the repo to EAS; turns on OTA updates (`app.config.ts` disables them without it) | open |
| **Bundle id / package name** (default `ng.com.promptiq.iqacademy`) | cannot be changed after the first store submission | **confirm now** |
| Apple Developer account, App Store Connect app, Team ID | iOS builds, TestFlight, submit | open |
| Google Play Console app | Android builds, internal testing, submit | open |
| APNs key (EAS can manage it) and **FCM v1 service-account JSON** | push notifications | open |
| Production `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_BASE_URL=https://classes.promptiq.com.ng`, `WEB_HOST=classes.promptiq.com.ng` | stored as EAS environment variables, never committed | open |
| Live **privacy policy URL** and support URL | both stores require them | open |
| Export-compliance answer (see §6) | Apple asks on every submission | **decision needed** |

After the first Android build, give the backend session the release **SHA-256** and the Apple Team ID so the `.well-known` association files can be published (W1).

## 1. One-time setup
**Install the workflows first.** The three GitHub Actions files are in `docs/ci-workflows/` (the token used for the first push could not write to `.github/workflows`). Copy them in with an account that can:
```sh
mkdir -p .github/workflows && cp docs/ci-workflows/*.yml .github/workflows/
```
`ci.yml` runs `npm run verify` and the fingerprint gate on every PR; `eas-preview-update.yml` publishes to `preview` on merge to `main`; `eas-production.yml` is the manual, approval-gated store build.

```sh
npm i -g eas-cli && eas login
eas init                      # writes the project id; copy it into EAS_PROJECT_ID below
eas env:create                # once per variable and per environment: development, preview, production
eas credentials               # iOS distribution cert + provisioning + push key; Android keystore (managed by EAS)
```
`app.config.ts` already gives each variant its own id (`.development`, `.preview`), so the three builds install side by side.

GitHub (Settings → Secrets and variables → Actions):
- secret `EXPO_TOKEN`, secret `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- variables `EAS_PROJECT_ID`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_WEB_BASE_URL`
- Environment **production** with *Required reviewers*, so `eas-production.yml` cannot run unapproved.

## 2. Channels and how updates reach people
| Channel | Build profile | Who gets it |
|---|---|---|
| `development` | development client | developers |
| `preview` | internal APK / ad-hoc | QA. **Every merge to `main` publishes here** (`eas-preview-update.yml`) |
| `production` | store builds | everyone. **Promoted by hand** after QA sign-off |

`runtimeVersion` is `{ policy: "appVersion" }`: an update reaches every build whose `version` in `app.config.ts` is the same. That is why `version` must change whenever the native side changes (§3).

## 3. Native changes vs over-the-air updates
**OTA is safe for** (JS and assets only): screens, copy, styles, logic, query/policy changes, new routes.
**Needs a new build and a `version` bump:** any new native package, plugin or permission, `app.config.ts` plugins/scheme/icons/splash, SDK upgrades, `runtimeVersion`. Full list: `port/NATIVE_DEPS.md`.

The gate that enforces this is `scripts/native-fingerprint.mjs`, run in CI and before every update/build:
```sh
npm run fingerprint            # fails if the native fingerprint changed and "version" did not
npm run fingerprint:accept     # after a deliberate native change: records the new baseline (.eas/fingerprint.json)
```
Releasing a native change: bump `version` → `npm run fingerprint:accept` → commit both → build → submit → only then publish updates. If the check fails for something that is not native (for example an `eas.json` edit), `--accept` it and say why in the PR. It ignores npm scripts and all JS.

## 4. Publishing and promoting JS updates
Preview happens automatically on merge. To publish by hand: `eas update --channel preview --message "…"` **(verified)**.
Promote to production only after QA signs off on preview: `eas update:republish` (interactive; pick the preview group and the production branch) **(unverified: confirm flags with `--help`)**.

**Staged rollout (verified):** `eas update --channel production --rollout-percentage=10`, watch the EAS dashboard, raise with `eas update:edit`, or undo with `eas update:revert-update-rollout`. While a *branch-based* rollout (`eas channel:rollout`) is running, `--channel` cannot be used; publish with `--branch`.

**Rollback (verified):** `eas update:rollback`, an interactive guide; choose "a previously published update" or "the embedded update". Publishing again afterwards reaches everyone.

## 5. Forcing an upgrade, and the in-app update check
- `app_settings.min_native_version` (live, readable by everyone) is `{ "ios": "1.0.0", "android": "1.0.0" }`. A build older than its platform's number sees a full-screen **Update required** screen (`src/features/release/UpdateGate.tsx`). It fails open: a missing or unreadable value never blocks anyone.
  Raise it only **after** the new build is live in the store, as an admin:
  ```sql
  update app_settings set value = jsonb_set(value, '{android}', '"1.1.0"') where key = 'min_native_version';
  ```
- The store buttons use `EXPO_PUBLIC_STORE_URL_IOS` / `_ANDROID` (set once the listings exist; Android falls back to `market://details?id=<package>`).
- The same component checks for an OTA update when the app returns to the foreground (at most every 15 minutes), downloads it, and asks "Restart now / Later".

## 6. Export compliance, privacy, store forms
- **Export compliance (decision needed).** The local database is encrypted with SQLCipher, which is encryption beyond what iOS provides, so `ITSAppUsesNonExemptEncryption` is **not** set to false by default. Whether the app qualifies for an exemption (and whether a filing applies) is a legal answer; get it from the owner or an adviser, then set the key in `app.config.ts` (a native change → version bump). Until then Apple will ask at each submission.
- **Dev-launcher keys.** `NSLocalNetworkUsageDescription` / `NSBonjourServices` come from the dev client. Inspect the production `.ipa`'s Info.plist and confirm they are absent before the first submission **(unverified)**.
- **Privacy label (Apple) and Data safety (Google):** worksheet in `docs/store-listing.md`.
- **Account deletion** is in the app (Profile → Delete my account, Edge Function `delete-account`). Both stores require it.
- **Notification permission** is asked from Profile, not at launch.

## 7. First release: go / no-go
1. `npm run verify` and `npm run fingerprint` green on `main`.
2. Device spikes in `port/SPIKES.md` passed (encrypted database, secure storage, deep links, camera QR, biometrics).
3. Push verified on a physical iPhone and Android phone.
4. Paystack tested in the live mode the owner chooses, including paying, closing the browser early, and paying offline.
5. Offline scenarios: sign in, open Home, go offline, check-in refused with a clear message, receipts queue and send on reconnect.
6. Low-end Android check (4 GB or less).
7. App lock on/off, step-up on an admin account, account deletion on a throwaway account.
8. Internal testing (TestFlight / Play internal) → approval → `eas submit` (or run `eas-production.yml` with *submit* ticked).
