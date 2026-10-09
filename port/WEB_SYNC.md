last_reviewed_web_sha: d14323f

# Web sync log

`last_reviewed_web_sha` (first line) is the newest web commit whose changes have been triaged. `scripts/web-drift.mjs` reads it.
Bump it **only after** the triage below is written. Newest entry first.

| date | from → to | by | what it meant for native |
|---|---|---|---|
| 2026-10-09 | 64bc5f7 → d14323f | native upgrade session | **Mine, done:** `sync-web` re-run (error message `not_eligible_for_solo` reworded), `gen-contracts` (`can_buy_solo` added, 96 RPCs). **Others':** `SoloCourses.tsx` (needs-a-pack notice, calls `can_buy_solo` before choosing a course; the database also enforces it in `create_solo_enrolment`) → M7a, noted in `port/inbox/M7a.md`; migration 56 `solo_needs_pack` is already live. |
| 2026-10-08 | 0081e66 → 64bc5f7 | native upgrade session | **Mine, done:** nav/tab redesign (avatar button, MENU_EXTRA, student/coordinator/director tab bars), `ui.tsx` (`Stat compact`, `StatStrip`, `Chip`, `ChipRow`), `feedback.tsx` offline + back-online cards, `lib/online.ts` → `src/data/net.ts` (ADR-016), new icons, error message line, 3 new routes. **Others':** door PIN (`doorLock`, `DoorPinSheet`, ClassScreen, migration 55) → M9a; `PinSetup/ChangePinForm staff` flag → M7a/M13; Profile door-PIN card + student-only reg no/PIN + sign-out → M13; Students/CentreClasses/Statement/useStaffCentres/DirectorHome/CoordinatorHome/Team → M9b; migrations 53–55 → `port/BACKEND.md`. |
| 2026-10-07 | 9ab5f13 → 0081e66 | M0–M5 session | Web added the 4-digit check-in PIN (`PinGate`, `PinInput`, RPCs `pin_required/has_pin/set_pin/change_pin`, migrations 50–52), hand check-in by registration number, `HandCheckIns` admin page (`/check-ins`), class reviews (`/reviews`, `ReviewSheet`, landing carousel), `ShareToChats`, 2-hour copy/share window, theme-coloured system bars, desktop sidebar. All folded into the plan: PIN → M7a/M9a, reviews → M7a/M10a/M6, share → M8, system bars → M2 (`ThemeProvider`), sidebar skipped (D6). |
