# Inbox for M9b

- [2026-10-08] from native upgrade (web 64bc5f7): **centre staff pages are new.** Routes `/students` (coordinator, director), `/centre-classes` (coordinator, director), `/statement` (director) already exist as stubs with guards. Port `Students, CentreClasses, Statement, lib/useStaffCentres.ts`, `DirectorHome` (now overview-only, uses `Stat compact`, `StatStrip`, `Chip/ChipRow`: all in `@/ui`), `CoordinatorHome`, `Team`. Data: `centre_students(p_centre_id)` (no email/phone/DOB; money columns directors only), `centre_statement(p_centre_id, p_month)`, `centre_dashboard`; frozen monthly statements (`centre_statements`). Reads are cacheable; nothing here is queued. Directors no longer get class reminders or the next-class card.

Other sessions append here when a change in *their* area affects *your* files. Newest first. Remove an entry when handled. Format: `- [date] from <module>: <what and why> (web sha / PR)`

