# IQ Academy: native app (Expo / React Native)

Port of the web app [`meckurypro/iqacademy`](https://github.com/meckurypro/iqacademy) (same Supabase backend, same UI/UX), with native additions: encrypted offline cache, push, local reminders, calendar, biometric lock.

**Building it with several AI sessions?** Start at [`AGENTS.md`](AGENTS.md) and [`port/PLAN.md`](port/PLAN.md).

## Run it
```bash
cp .env.example .env.local        # fill EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY (same project as the web app)
npm install
npm run verify                    # typecheck + lint + tests
eas build --profile development   # a development build is REQUIRED: Expo Go cannot run SQLCipher or push
npm start                         # then open the dev build on a device
```
`/dev/gallery` (design system) and `/dev/spikes` (device checks) exist in development builds.

## Layout
| Path | What |
|---|---|
| `src/app` | expo-router routes (stubs until their module lands) |
| `src/shell` | header, bell, tab bar, drawer, guards, `Screen` |
| `src/ui` | design system (`@/ui`) |
| `src/core` | Supabase client, session/auth, clock, secure storage, errors |
| `src/data` | encrypted local DB, query cache, outbox, realtime, `mutate` |
| `src/shared` | pure libs (`web/` = generated from the web app) |
| `src/features` | one folder per module |
| `port/` | plan, decisions, parity ledger, contracts, inboxes |
| `scripts/` | `sync-web`, `web-drift`, `parity`, `routes`, `gen-contracts` |

## Scripts
`npm run verify` · `npm run drift` (what changed on web) · `npm run sync-web` (regenerate derived files) · `node scripts/parity.mjs` · `node scripts/routes.mjs [--check]` · `node scripts/gen-contracts.mjs`

## Shipping
Channels `development` / `preview` / `production` (`eas.json`); `runtimeVersion` follows `version` (policy `appVersion`). OTA = JS and assets only; anything in `port/NATIVE_DEPS.md` needs a new build. Release steps are M14.
