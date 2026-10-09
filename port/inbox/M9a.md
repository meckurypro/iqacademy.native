# Inbox for M9a

- [2026-10-08] from native upgrade (web 64bc5f7): **door PIN for staff.** Port `lib/doorLock.ts` (in-memory unlock for 5 min, tied to the user id, cleared on sign-out; replace `document.visibilitychange` with `AppState` going to background), `components/DoorPinSheet.tsx`, and the ClassScreen changes. Rules: instructors teaching the class and coordinators must enter their door PIN before the class code/QR shows or a hand check-in; **admins are not asked** (they have the written-reason override); `needsDoorPin(roles)`. Server: `verify_staff_pin` → `'ok'|'pin_incorrect'|'pin_locked'|'pin_not_set'` (wrong tries are counted; 5 wrong = 15 min pause). `mark_attendance` now returns `already_present` (show "Already checked in", never claim a check-in), only works inside the check-in window, and directors can no longer mark by hand. All online-only. See `port/BACKEND.md` migrations 53 and 55.

Other sessions append here when a change in *their* area affects *your* files. Newest first. Remove an entry when handled. Format: `- [date] from <module>: <what and why> (web sha / PR)`

