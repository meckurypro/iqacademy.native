# Inbox for M7b

Other sessions append here when a change in *their* area affects *your* files. Newest first. Remove an entry when handled. Format: `- [date] from <module>: <what and why> (web sha / PR)`


- 2026-10-09: `src/features/enrol/pay.ts` + `payFlow.ts` already hold the native payment flow (`payInstalment(instalmentId)` → PayStatus). Important: `paystack-init-payment` only honours a `callback_url` on the web site's own origin (SITE_URL); a custom app link is silently replaced. So the browser lands on the web `/payment/callback` page and the app does not rely on it: after the browser closes it asks `paystack-verify-payment` for the reference (6 tries, 2.5 s apart). Reuse this for Enrol and instalments instead of building a second flow.

- 2026-10-10 (owner confirmations, see BACKEND.md): `SITE_URL` is `https://classes.promptiq.com.ng`, so the web `callback_url` is honoured, but **Paystack keys are not configured yet**: `paystack-init-payment` cannot complete a payment until they are. The native flow in `src/features/enrol/pay.ts` / `payFlow.ts` does not depend on the callback page (it asks `paystack-verify-payment` after the browser closes), so it works either way once keys exist. Not yet run against live Paystack.
