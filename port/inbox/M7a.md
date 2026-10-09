# Inbox for M7a

- [2026-10-08] from native upgrade (web 64bc5f7): `PinSetup` and `ChangePinForm` take a `staff` flag (`set_staff_pin`/`change_staff_pin` instead of `set_pin`/`change_pin`; same screens). Build them once with the flag so M9a and M13 reuse them. `ClassCountdown`/`my_class_clock` no longer include directors. Keypad primitive: `@/ui` `PinInput`.

Other sessions append here when a change in *their* area affects *your* files. Newest first. Remove an entry when handled. Format: `- [date] from <module>: <what and why> (web sha / PR)`


- 2026-10-09 (web d14323f): `SoloCourses` now calls `can_buy_solo` (online-only, no args, returns boolean) when a course is chosen. If `false`, show the polite "Single courses come after a course pack" notice with a "See course packs" button to `/enrol` and do not go on to centre selection. The database enforces the same rule in `create_solo_enrolment` (error key `not_eligible_for_solo`, wording already synced).
