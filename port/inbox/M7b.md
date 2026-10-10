# Inbox for M7b

Other sessions append here when a change in *their* area affects *your* files. Newest first. Remove an entry when handled. Format: `- [date] from <module>: <what and why> (web sha / PR)`


- 2026-10-09: `src/features/enrol/pay.ts` + `payFlow.ts` already hold the native payment flow (`payInstalment(instalmentId)` → PayStatus). Important: `paystack-init-payment` only honours a `callback_url` on the web site's own origin (SITE_URL); a custom app link is silently replaced. So the browser lands on the web `/payment/callback` page and the app does not rely on it: after the browser closes it asks `paystack-verify-payment` for the reference (6 tries, 2.5 s apart). Reuse this for Enrol and instalments instead of building a second flow.
