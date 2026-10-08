last_reviewed_web_sha: 0081e66

# Web sync log

`last_reviewed_web_sha` (first line) is the newest web commit whose changes have been triaged. `scripts/web-drift.mjs` reads it.
Bump it **only after** the triage below is written. Newest entry first.

| date | from → to | by | what it meant for native |
|---|---|---|---|
| 2026-10-07 | 9ab5f13 → 0081e66 | M0–M5 session | Web added the 4-digit check-in PIN (`PinGate`, `PinInput`, RPCs `pin_required/has_pin/set_pin/change_pin`, migrations 50–52), hand check-in by registration number, `HandCheckIns` admin page (`/check-ins`), class reviews (`/reviews`, `ReviewSheet`, landing carousel), `ShareToChats`, 2-hour copy/share window, theme-coloured system bars, desktop sidebar. All folded into the plan: PIN → M7a/M9a, reviews → M7a/M10a/M6, share → M8, system bars → M2 (`ThemeProvider`), sidebar skipped (D6). |
