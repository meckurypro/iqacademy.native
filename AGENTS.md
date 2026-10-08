# IQ Academy native app: rules for every AI session

This is the React Native (Expo) port of the web app `meckurypro/iqacademy`. It is built by **parallel sessions, one module each**, against a web app that is **still changing**. Read `port/PLAN.md` first (modules, owned paths, order), then `port/DECISIONS.md`.

## Start of every session (about 5 minutes)
1. Clone/update the web repo next to this one (`../iqacademy`, or set `WEB_REPO`). `git pull` here.
2. `node scripts/web-drift.mjs` (fetches web, compares with `last_reviewed_web_sha` in `port/WEB_SYNC.md`, lists affected files **by owner module**, migrations, unmapped files, route drift).
3. Triage what it prints. **Yours** → port it. **Someone else's** → append to `port/inbox/<module>.md` and do not touch their files. **Migration** → update `port/CONTRACTS.md` (`node scripts/gen-contracts.mjs`) and tell M3/M4. **New route** → add to `port/route-manifest.json`, run `node scripts/routes.mjs`. **Generated file affected** → `npm run sync-web`.
4. Write the triage in `port/WEB_SYNC.md`, **then** bump `last_reviewed_web_sha`. Never bump first.
5. Pick your module: read `port/PLAN.md` status, take the highest-priority module whose dependencies are done and that nobody has claimed (open PR or branch `port/<module>-*`). Claim it by opening a draft PR immediately.

## Hard rules
- **Own paths only.** Edit only the paths your module owns (PLAN §7.2). Hot files (`package.json`, `app.config.ts`, `eas.json`, `src/app/_layout.tsx`, `port/PARITY.md`, `port/route-manifest.json`): additive edits, rebase right before PR, never reformat.
- **Never edit generated files** (`src/shared/web/*`, `*.generated.ts(x)`). Change the web source or the patch in `scripts/sync-web.mjs`, then `npm run sync-web`.
- **Never import the Supabase client** in screens (`@supabase/supabase-js`, `@/core/supabase`). Use `useQuery` / `useRpc` / `mutate` from `@/data`. ESLint enforces it. New writes: add the RPC to `src/data/policies.ts` only if it is safe to repeat; otherwise it is online-only by default.
- **Use `@/ui` primitives** and `useFeedback()` (`run` for every write, `confirm` for destructive actions, `friendly()` for errors). Show times only through `@/shared/web/time` helpers (Lagos time, server-corrected clock); never `new Date()` / `toLocale*` for anything displayed.
- **No new native module, plugin option or permission without recording it in `port/NATIVE_DEPS.md` first.** It forces a new binary.
- **Migrations and Edge Functions belong to the web repo / `iq-academy-db`**, never here. Propose them in your PR description.
- **Never guess an Expo/RN API.** Read the installed package's types in `node_modules` or the versioned docs. Say what you could not verify.
- Replace the M5 route stub with the real screen and keep the default export. Role guards live in `port/route-manifest.json`.

## Definition of done (every module)
`npm run verify` (typecheck + lint + tests) passes · empty/loading/error/**offline** states and light + dark · ledger rows updated with `node scripts/parity.mjs set …` (status, native path, `--sha`) · web-vs-native screenshots at 390px in `port/parity/<module>/` · unit tests for pure logic · web sha you ported from named in the PR · inbox entries for anyone you affect · module row in `port/PLAN.md` status updated.

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
                            # (no network to api.expo.dev? read the pin from node_modules/expo/bundledNativeModules.json and `npm install pkg@that-version`)
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.config.ts` and config plugins (there is no app.json).
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
