# IQ Academy native: device spikes, QA and parity sweeps

For a session where the **owner has a phone with a development build**. You cannot run a device; the owner can. You direct, interpret, fix, and record. The owner is terse: give exact commands and exact taps, one step at a time, and ask for pasted output rather than assuming. Never guess a result; say **unverified**.

Setup as in `00-universal-session.md` §0 and §1 (clone the native repo and `../iqacademy`; read `AGENTS.md`, `port/PLAN.md`, `port/DECISIONS.md`, `port/SPIKES.md`, `port/NATIVE_DEPS.md`). Work on a branch `port/qa-<date>`, PR at the end. Do not push to `main`.

## Part 1: build and run the spikes (M1)
1. Owner runs (needs an Expo account and, for iOS, an Apple developer account; Android works without store accounts):
   `npm ci && npx eas-cli login && npx eas-cli build --profile development --platform android`  (then `--platform ios` when ready). Install the build. Start Metro with `npm start`. Env: copy `.env.example` to `.env.local`; the owner pastes the Supabase URL and anon key themselves.
2. Open the app, then go to `/dev/spikes` (type the route in the dev menu or `npx uri-scheme open iqacademy:///dev/spikes --android`). Run **S1**, **S3**, **S4**; tap **Copy report**; the owner pastes the report here.
3. Interpret using `port/SPIKES.md`:
   - **S1:** which time strategy did Hermes pick (`intl` or `shifted`)? Any failing check means `src/shared/web/time.ts` or `scripts/sync-web.mjs` needs a fix: trace it to the exact function, fix in the generator (never edit the generated file), re-run `npm run sync-web`, add a unit test, ask the owner to re-run.
   - **S4:** `cipher_version` must be present; right key reads; wrong/no key rejected. If SQLCipher is not active, check the dev client was built after the `useSQLCipher` plugin (needs a **new build**, not a reload) and look at `expo.sqlite.useSQLCipher` in the prebuild output.
   - **S3 storage half:** must pass. For the link half: owner signs up with a real email, opens the confirmation link on the phone and on a computer, and reports what happens (needs backend B5 done first; if not, say so).
4. Write one ADR per spike into `port/DECISIONS.md` with the pasted evidence and the date; update the status in `port/PLAN.md` (M1 row) and `port/SPIKES.md`.
5. S5 (realtime after backgrounding), S6 (push), S7 (Paystack), S8 (QR) run later, when their modules exist; add their step lists to the PR as checkboxes for the owner.

## Part 2: visual parity (M15)
For each module that has landed (see `PLAN.md`), with the web app open at 390px wide and the native app on the phone:
- Open `/dev/gallery` first. Compare every primitive in light and dark against the web's equivalent. Record differences as `file:line, observed, expected` (spacing, radii, font weight, colour, icon, shadow, blur). Fix them in `src/ui` (M2's paths), keeping the web's class values as the reference.
- For each ported screen compare: loading, empty, populated, error, offline (airplane mode), dark mode, long text, 200% font size, keyboard open. Save paired screenshots in `port/parity/<module>/`.
- Use the sign-in accounts the owner provides (student, instructor, admin) and state which role you used.
- Test on the **slowest Android phone the owner has** (low RAM is the real target): note scroll jank in the gallery and lists, and whether blur (iOS only) or animations need to be reduced.
- Update `port/PARITY.md` rows (`node scripts/parity.mjs set …`), marking `diverged` with a reason where the phone must differ.

## Part 3: weekly web-drift sweep (M15)
`node scripts/web-drift.mjs --mark` then `node scripts/parity.mjs`. For every `stale` row decide: still correct (set `ported`, new sha), or needs work (inbox for the owner module, or fix if trivial and in your paths). Also run `port/sql/inventory.sql` through the Supabase connector if attached (read-only) and diff against `port/BACKEND.md`. Write the result in `port/WEB_SYNC.md` and bump `last_reviewed_web_sha` only afterwards.

## Output
A PR with ADRs, parity screenshots/notes, fixes, and a final message of at most 10 lines: what passed, what failed, what the owner must do next.
