# Parity ledger

Generated from `port/parity.json` by `scripts/parity.mjs`. Edit with `node scripts/parity.mjs set <web-file> --status … --native … --sha …`, never by hand.

wip: 7 · todo: 68 · ported: 22 · skip: 2

| web file | module | mode | status | native | ported from | note |
|---|---|---|---|---|---|---|
| `App.tsx` | M5 | port | wip | `src/app/_layout.tsx, src/app/(app)/_layout.tsx, src/shell/*` | 64bc5f7 | shell, gate, guards, tab bars (student/instructor/coordinator/director/admin), avatar button, drawer done; 3 new routes are stubs |
| `components/AssignSheet.tsx` | M10b | port | todo |  |  |  |
| `components/ChannelRow.tsx` | M8 | port | todo |  |  |  |
| `components/ChatBubble.tsx` | M8 | port | todo |  |  |  |
| `components/CheckInVerdict.tsx` | M7a | port | todo |  |  |  |
| `components/ClassComposer.tsx` | M8 | port | todo |  |  |  |
| `components/ClassCountdown.tsx` | M7a | port | todo |  |  |  |
| `components/ClockWatch.tsx` | M3 | port | ported | `src/core/clock.ts, src/shell/ClockNotice.tsx` | 0081e66 |  |
| `components/CourseOutline.tsx` | M7a | port | todo |  |  |  |
| `components/CustomClassCard.tsx` | M9b | port | todo |  |  |  |
| `components/CustomClassSheet.tsx` | M9b | port | todo |  |  |  |
| `components/CustomClassStudents.tsx` | M9b | port | todo |  |  |  |
| `components/DoorPinSheet.tsx` | M9a | port | todo |  |  |  |
| `components/DoorToday.tsx` | M9b | port | todo |  |  |  |
| `components/ErrorBoundary.tsx` | M0 | port | ported | `src/shell/ErrorBoundary.tsx` | 0081e66 |  |
| `components/feedback.tsx` | M2 | port | ported | `src/ui/feedback.tsx` | 64bc5f7 | offline notice + Back online/Refresh added (64bc5f7); toasts in root view, covered by an open sheet; Refresh revalidates instead of reloading |
| `components/Icon.tsx` | M2 | generated | ported | `src/ui/icons.generated.tsx + src/ui/Icon.tsx` | 64bc5f7 |  |
| `components/MakeupCard.tsx` | M7a | port | todo |  |  |  |
| `components/MessageBubble.tsx` | M8 | port | todo |  |  |  |
| `components/MessagesRoute.tsx` | M5 | port | wip | `src/app/(app)/messages/*` | 0081e66 | route stubs only; M8 implements |
| `components/MyCentres.tsx` | M13 | port | todo |  |  |  |
| `components/NavMenu.tsx` | M5 | port | ported | `src/shell/NavMenu.tsx` | 64bc5f7 | slimmed to MENU_EXTRA leftovers; no hamburger when empty (64bc5f7) |
| `components/PasswordFields.tsx` | M6 | port | todo |  |  |  |
| `components/PinGate.tsx` | M7a | port | todo |  |  |  |
| `components/PinInput.tsx` | M2 | port | wip | `src/ui/PinInput.tsx` | 0081e66 | keypad input only; PinSetup/ChangePinForm now take a `staff` flag (set_staff_pin / change_staff_pin): M7a builds them, M9a/M13 reuse |
| `components/Place.tsx` | M2 | port | ported | `src/ui/Place.tsx` | 0081e66 | takes an explicit size (no em units) |
| `components/QrScanner.tsx` | M7a | port | todo |  |  |  |
| `components/ReviewSheet.tsx` | M7a | port | todo |  |  |  |
| `components/RunReminder.tsx` | M9b | port | todo |  |  |  |
| `components/ShareToChats.tsx` | M8 | port | todo |  |  |  |
| `components/Sidebar.tsx` | skip | skip | skip |  |  | desktop-only / not used on phones |
| `components/SoloCourses.tsx` | M7a | port | ported | `src/features/student/SoloCourses.tsx` | d14323f | (offers, paid-pack notice, centre choice, Paystack in the in-app browser). Mounted on the student home. Pay step is untested against live Paystack; no screenshot pair yet |
| `components/SoloPrices.tsx` | M10b | port | todo |  |  |  |
| `components/Stars.tsx` | M2 | port | ported | `src/ui/Stars.tsx` | 0081e66 |  |
| `components/ui.tsx` | M2 | port | ported | `src/ui/ui.tsx, src/ui/Sheet.tsx, src/ui/SelectSheet.tsx` | 64bc5f7 | Stat compact, StatStrip, Chip, ChipRow added (64bc5f7); Split/Main/Rail single-column on phones |
| `index.css` | M2 | generated | ported | `src/theme/tokens.generated.ts` | 64bc5f7 |  |
| `lib/auth.tsx` | M3 | port | ported | `src/core/auth.tsx, src/core/session.tsx` | 0081e66 | roles via data layer (cached/offline) + rolesReady |
| `lib/centre.ts` | M3 | generated | ported | `src/shared/web/centre.ts` | 64bc5f7 |  |
| `lib/channels.ts` | M3 | generated | ported | `src/shared/web/channels.ts` | 64bc5f7 |  |
| `lib/checkin.ts` | M7a | port | wip | `src/shared/checkin.ts` | 0081e66 | types/doorState only; useCheckedIn hook is M7a |
| `lib/classClock.ts` | M7a | port | wip | `src/shared/classClock.ts` | 0081e66 | pure part only; useTicker/useClassClock are M7a/M9a |
| `lib/db.ts` | M3 | generated | ported | `src/shared/web/db.ts` | 64bc5f7 |  |
| `lib/doorLock.ts` | M9a | port | todo |  |  |  |
| `lib/messages.ts` | M8 | port | wip | `src/shared/messages.ts` | 0081e66 | pure part only; download/share/copy/forward + unread hook are M8 |
| `lib/nav.ts` | M5 | generated | ported | `src/shell/nav.generated.ts` | 64bc5f7 |  |
| `lib/notifications.ts` | M11a | port | todo |  |  |  |
| `lib/offline.ts` | M7b | port | wip | `src/shared/offline.ts` | 0081e66 | types/limits only; prepareReceipt → expo-image-manipulator in M7b |
| `lib/online.ts` | M4a | port | ported | `src/data/net.ts` | 64bc5f7 | NetInfo link + same server probe, 2-strike rule, 20s/4s cadence; pauses in background (ADR-016) |
| `lib/password.ts` | M3 | generated | ported | `src/shared/web/password.ts` | 64bc5f7 |  |
| `lib/payment.ts` | M7b | port | todo |  |  |  |
| `lib/roster.ts` | M3 | generated | ported | `src/shared/web/roster.ts` | 64bc5f7 |  |
| `lib/supabase.ts` | M3 | generated | ported | `src/shared/web/errors.ts (MESSAGES, friendly) + src/core/errors.ts` | 64bc5f7 |  |
| `lib/theme.ts` | M2 | port | ported | `src/theme/ThemeProvider.tsx` | 0081e66 |  |
| `lib/time.ts` | M3 | generated | ported | `src/shared/web/time.ts` | 64bc5f7 |  |
| `lib/useMedia.ts` | skip | skip | skip |  |  | desktop-only / not used on phones |
| `lib/useStaffCentres.ts` | M9b | port | todo |  |  |  |
| `lib/verify.ts` | M3 | port | ported | `src/shared/verify.ts` | 0081e66 | localStorage → kv |
| `main.tsx` | M0 | port | ported | `src/app/_layout.tsx` | 0081e66 |  |
| `pages/AdminHome.tsx` | M10a | port | todo |  |  |  |
| `pages/Announce.tsx` | M10a | port | todo |  |  |  |
| `pages/CentreClasses.tsx` | M9b | port | todo |  |  |  |
| `pages/Centres.tsx` | M10a | port | todo |  |  |  |
| `pages/ClassChannel.tsx` | M8 | port | todo |  |  |  |
| `pages/ClassMessagesAdmin.tsx` | M10a | port | todo |  |  |  |
| `pages/ClassReviews.tsx` | M10a | port | todo |  |  |  |
| `pages/ClassScreen.tsx` | M9a | port | todo |  |  |  |
| `pages/CoordinatorHome.tsx` | M9b | port | todo |  |  |  |
| `pages/CourseBuilder.tsx` | M10b | port | todo |  |  |  |
| `pages/CustomClasses.tsx` | M9b | port | todo |  |  |  |
| `pages/DirectorHome.tsx` | M9b | port | todo |  |  |  |
| `pages/Enrol.tsx` | M7b | port | todo |  |  |  |
| `pages/HandCheckIns.tsx` | M10a | port | todo |  |  |  |
| `pages/InstructorHistory.tsx` | M9a | port | todo |  |  |  |
| `pages/InstructorHome.tsx` | M9a | port | todo |  |  |  |
| `pages/InstructorMessages.tsx` | M8 | port | todo |  |  |  |
| `pages/Instructors.tsx` | M10a | port | todo |  |  |  |
| `pages/Landing.tsx` | M6 | port | todo |  |  |  |
| `pages/Login.tsx` | M6 | port | todo |  |  |  |
| `pages/Manage.tsx` | M10a | port | todo |  |  |  |
| `pages/Messages.tsx` | M8 | port | todo |  |  |  |
| `pages/MyClasses.tsx` | M9a | port | todo |  |  |  |
| `pages/Notifications.tsx` | M11a | port | todo |  |  |  |
| `pages/OfflinePay.tsx` | M7b | port | todo |  |  |  |
| `pages/OfflinePayments.tsx` | M10c | port | todo |  |  |  |
| `pages/PayCallback.tsx` | M7b | port | todo |  |  |  |
| `pages/Payments.tsx` | M10c | port | todo |  |  |  |
| `pages/Payouts.tsx` | M10c | port | todo |  |  |  |
| `pages/Prices.tsx` | M10b | port | todo |  |  |  |
| `pages/Profile.tsx` | M13 | port | todo | `src/shell/ProfileInterim.tsx (interim)` | 64bc5f7 | web moved sign-out + theme here, adds Door PIN card for instructors/coordinators and hides reg no/PIN for non-students; M13 replaces the interim screen |
| `pages/ResetPassword.tsx` | M6 | port | todo |  |  |  |
| `pages/Roster.tsx` | M10b | port | todo |  |  |  |
| `pages/Schedule.tsx` | M9b | port | todo |  |  |  |
| `pages/StaffHome.tsx` | M9b | port | todo |  |  |  |
| `pages/Statement.tsx` | M9b | port | todo |  |  |  |
| `pages/StudentHome.tsx` | M7a | port | todo |  |  |  |
| `pages/Students.tsx` | M9b | port | todo |  |  |  |
| `pages/Team.tsx` | M9b | port | todo |  |  |  |
| `pages/Users.tsx` | M10a | port | todo |  |  |  |
| `pages/VerifyEmail.tsx` | M6 | port | todo |  |  |  |
