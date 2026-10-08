# Spikes (M1)

Run on a **development build** (`eas build --profile development`), open `/dev/spikes` (dev builds show it; `EXPO_PUBLIC_DEV_TOOLS=1` enables it elsewhere), tap Run, tap **Copy report**, paste into `port/DECISIONS.md` under a new ADR. Expected-values are computed by arithmetic, so a failure means the engine is wrong, not the test.

| Spike | State | How |
|---|---|---|
| S1 Hermes + Lagos time + Intl | **code written, needs device** | `/dev/spikes` → S1. Tells you which strategy time.ts picked (`intl` or `shifted`). Either is correct; `shifted` is the safety net |
| S2 Styling / performance | **decided provisionally** (ADR-002) | Remaining: open `/dev/gallery` on a ≤3 GB Android phone, scroll, open sheets, toggle dark mode; note jank. Compare screenshots with the web at 390 px |
| S3 Auth storage + links | storage half written | `/dev/spikes` → S3. The link half needs a real signup: register with an email, open the confirmation link on the same and on another device, expect `iqacademy://auth/callback#…` to sign in (needs B5: redirect URL allow-listed in Supabase) |
| S4 SQLCipher | **code written, needs device** | `/dev/spikes` → S4. Passes only if `PRAGMA cipher_version` returns a version, the right key reads, wrong/no key is rejected |
| S5 Realtime on RN | needs account + M11a | sign in, background the app 2 min, create a notification row server-side, foreground: the bell must update without a manual refresh. If not, adjust `DataProvider` resume logic |
| S6 Push round trip | needs M11a + B1/B2 + APNs/FCM | physical device only |
| S7 Paystack return | needs M7b (B6 dropped, ADR-012) | in-app browser, then poll `paystack-verify-payment` with the reference; test cancel / fail / success / app-killed-mid-payment (webhook should still complete it) |
| S8 Door QR scan | needs M7a | low light, glare, torch, 20 scans at arm's length |
