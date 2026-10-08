# Kickoff prompts

Paste one of these into a fresh AI session, **plus a short header** with what only you know:

```
Web repo:    https://github.com/meckurypro/iqacademy
Native repo: https://github.com/meckurypro/iqacademy.native
GitHub token: <fine-grained token: contents + pull requests (write) on the native repo, read on the web repo>
Supabase connector: attached / not attached
Module (optional): M6   <- leave out to let the session choose
```

| File | Use it for | Needs |
|---|---|---|
| `00-universal-session.md` | **Default.** The session orients, checks web drift, chooses an unclaimed module by priority, claims it with a draft PR, builds it, hands off | native repo, token |
| `01-backend-web-session.md` | The only session allowed to change Supabase and the web repo: push tokens, push sender, chat idempotency, account deletion, min-version flag, app-link files | Supabase connector, web repo write, your approval of each change |
| `02-device-spikes-and-qa.md` | You have a phone with a development build: run the spikes, fix what they find, then do visual parity and weekly drift sweeps | a device, a dev build |
| `03-release-engineering.md` | EAS credentials, channels, OTA runbook, store submission | Expo + Apple + Google accounts |

Run several `00` sessions in parallel. Each claims a different module by opening a draft PR on a `port/<module>-<slug>` branch; a session that finds its choice already claimed takes the next one.
