# Inbox for M7b

Other sessions append here when a change in *their* area affects *your* files. Newest first. Remove an entry when handled. Format: `- [date] from <module>: <what and why> (web sha / PR)`




- 2026-10-10 (owner confirmations, see BACKEND.md): `SITE_URL` is `https://classes.promptiq.com.ng`, so the web `callback_url` is honoured, but **Paystack keys are not configured yet**: `paystack-init-payment` cannot complete a payment until they are. The native flow in `src/features/enrol/pay.ts` / `payFlow.ts` does not depend on the callback page (it asks `paystack-verify-payment` after the browser closes), so it works either way once keys exist. Not yet run against live Paystack.
