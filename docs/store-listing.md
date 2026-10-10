<!-- docs/store-listing.md -->
# Store listing: draft for the owner to approve

Everything below is **draft copy and a worksheet**. Nothing is submitted. Items marked ❓ need the owner or a check on a real build.

## Listing text
- **Name:** IQ Academy
- **Subtitle (iOS, 30 chars):** Learn practical AI skills
- **Short description (Google, 80 chars):** Practical AI classes: enrol, pay, check in and stay in touch with your class.
- **Description:**
  IQ Academy is the learning app for PromptIQ AI Agency's training centres. Practical AI skills, taught by people who build with AI, in person at a centre near you.
  • Browse courses and packs, enrol and pay securely online or by transfer
  • See your next class with a live countdown, and check in by scanning the class QR code
  • Follow your progress through each course and catch up on missed classes
  • Class messages from your instructor, with files and updates
  • Instructors and coordinators run the door, see rosters and message classes
  • Optional app lock with fingerprint or face, and light and dark themes
- **Keywords (iOS, 100 chars):** AI,training,course,class,academy,Nigeria,Lagos,learn,workshop,cohort,PromptIQ
- **Category:** Education
- **Support URL / Privacy policy URL:** ❓ owner to provide the live URLs
- **Assets still to make:** icon 1024×1024, screenshots (iPhone 6.9″ and 6.5″, Android phone), feature graphic 1024×500.

## Data collected: worksheet for Apple "App Privacy" and Google "Data safety"
Derived from `port/NATIVE_DEPS.md` and `port/BACKEND.md`. ❓ = confirm against the final build.

| Data | Why | Linked to the person | Shared with | Optional |
|---|---|---|---|---|
| Name, email | account, class lists | yes | Supabase (processor) | no |
| Phone number | contact | yes | Supabase | yes |
| Profile photo | avatar | yes | Supabase storage | yes |
| Payment records (amounts, status, receipts they upload) | tuition | yes | Paystack processes cards; the app never sees card numbers ❓ | no |
| Attendance, class messages, reviews | the service | yes | Supabase | no |
| Push token | notifications | yes | Expo push service ❓ | yes (permission) |
| Precise/coarse location | admins set a centre's position, **foreground only** | not stored with the person ❓ | none | yes |
| Calendar (write) | add class times to the device calendar | stays on device | none | yes |
| Camera | scan the class QR, photograph a receipt | not stored unless the person uploads | none | yes |
| Face ID / fingerprint | local app lock | **never leaves the device; no biometric data collected** | none | yes |
| Crash and diagnostics | ❓ none today: no crash reporter is installed | n/a | n/a | n/a |

Not collected: microphone, contacts, background location, advertising ID, tracking across apps (so no App Tracking Transparency prompt) ❓ confirm no SDK adds one.

## Policy checks to confirm (current store text, not memory) ❓
- Tuition for in-person classes paid through an external gateway (Paystack): both stores' rules on physical-service payments.
- Android 14+ notification and foreground-service rules; `POST_NOTIFICATIONS` prompt timing (we ask from Profile).
- Apple review notes: give the reviewer a student demo account and explain the in-person nature of the classes.
