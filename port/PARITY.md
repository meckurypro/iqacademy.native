# Parity ledger

Generated from `port/parity.json` by `scripts/parity.mjs`. Edit with `node scripts/parity.mjs set <web-file> --status … --native … --sha …`, never by hand.

wip: 1 · ported: 103 · skip: 2 · diverged: 3

| web file | module | mode | status | native | ported from | note |
|---|---|---|---|---|---|---|
| `App.tsx` | M5 | port | wip | `src/app/_layout.tsx, src/app/(app)/_layout.tsx, src/shell/*` | 1a13ada | shell, gate, guards, tab bars, avatar button, drawer done; /pay/return added at web 1a13ada |
| `components/AssignSheet.tsx` | M10b | port | ported | `src/features/admin-classes/AssignSheet.tsx` | d14323f |  |
| `components/BankAccountSheet.tsx` | unassigned | port | ported | `src/features/wallet/BankAccountSheet.tsx` | d1139f4 | uses SearchField + SelectSheet; also used by DirectorHome |
| `components/CashParts.tsx` | M16 | port | ported | `src/features/cash/CashParts.tsx` | bbc9758 |  |
| `components/ChannelRow.tsx` | M8 | port | ported | `src/features/channels/ChannelRow.tsx` | d14323f |  |
| `components/ChatBubble.tsx` | M8 | port | ported | `src/features/channels/ChatBubble.tsx, src/features/channels/MessageActions.tsx` | d14323f | tap opens actions (copy / share / save / send on / select more), long-press starts selecting (instructor), checkbox selection, 2 h copy/share window for students (server-corrected clock, re-checked at the tap). Share of text uses the system share sheet; a file is downloaded to cache and shared, then deleted |
| `components/CheckInVerdict.tsx` | M7a | port | ported | `src/features/student/CheckInVerdict.tsx` | d14323f |  |
| `components/ClassComposer.tsx` | M8 | port | ported | `src/features/channels/Composer.tsx` | d14323f | text + one file (photo/video from library, or any file) up to 25 MB; sent through the outbox so it survives offline and a retry never doubles it |
| `components/ClassCountdown.tsx` | M7a | port | ported | `src/features/student/ClassCountdown.tsx` | d14323f |  |
| `components/ClockWatch.tsx` | M3 | port | ported | `src/core/clock.ts, src/shell/ClockNotice.tsx` | 0081e66 |  |
| `components/CourseOutline.tsx` | M7a | port | ported | `src/features/student/CourseOutline.tsx` | d14323f |  |
| `components/CustomClassCard.tsx` | M9b | port | ported | `src/features/student/CustomClassCard.tsx` | d14323f | student side only; instructor side (CustomClassSheet/Students) stays with M9b |
| `components/CustomClassSheet.tsx` | M9b | port | ported | `src/features/staff/CustomClassSheet.tsx` | d14323f | pickers are JS-only (src/ui/extras.tsx); invited list is derived (base + added - removed) so a save sends only the difference; online-only |
| `components/CustomClassStudents.tsx` | M9b | port | ported | `src/features/staff/CustomClassStudents.tsx` | d14323f | same search and group rules as web; results scroll inside the sheet |
| `components/DoorPinSheet.tsx` | M9a | port | ported | `src/features/class/DoorPinSheet.tsx` | d14323f | online-only; reuses PinSetup staff from student/Pin |
| `components/DoorToday.tsx` | M9b | port | ported | `src/features/staff/DoorToday.tsx` | d14323f | reads today's classes from the cache, refreshed by the "sessions" tag |
| `components/ErrorBoundary.tsx` | M0 | port | ported | `src/shell/ErrorBoundary.tsx` | 0081e66 |  |
| `components/feedback.tsx` | M2 | port | ported | `src/ui/feedback.tsx` | 64bc5f7 | offline notice + Back online/Refresh added (64bc5f7); toasts in root view, covered by an open sheet; Refresh revalidates instead of reloading |
| `components/Icon.tsx` | M2 | generated | ported | `src/ui/icons.generated.tsx + src/ui/Icon.tsx` | d1139f4 |  |
| `components/MakeupCard.tsx` | M7a | port | ported | `src/features/student/MakeupCard.tsx` | d14323f |  |
| `components/MessageBubble.tsx` | M8 | port | ported | `src/features/channels/MessageBubble.tsx` | d14323f | card style for lists; used by ClassMessagesAdmin (Delete passed as footer). ClassScreen's admin view keeps ChatBubble + Composer, as M9a asked |
| `components/MessagesRoute.tsx` | M5 | port | ported | `src/features/channels/Messages.tsx, src/app/(app)/messages/index.tsx, src/app/(app)/messages/[id].tsx` | d14323f | role choice (instructor list vs student list) lives in Messages.tsx; routes are real screens, no longer stubs |
| `components/MyCentres.tsx` | M13 | port | ported | `src/features/profile/MyCentres.tsx` | d14323f |  |
| `components/NavMenu.tsx` | M5 | port | ported | `src/shell/NavMenu.tsx` | 64bc5f7 | slimmed to MENU_EXTRA leftovers; no hamburger when empty (64bc5f7) |
| `components/PasswordFields.tsx` | M6 | port | ported | `src/features/auth/PasswordFields.tsx` | d14323f | clipboard via expo-clipboard |
| `components/PinGate.tsx` | M7a | port | ported | `src/features/student/Pin.tsx` | d14323f | Modal over the whole app; mounted for students in (app)/_layout |
| `components/PinInput.tsx` | M2 | port | ported | `src/ui/PinInput.tsx, src/features/student/Pin.tsx` | d14323f | PinSetup/ChangePinForm take staff (door PIN) |
| `components/Place.tsx` | M2 | port | ported | `src/ui/Place.tsx` | 0081e66 | takes an explicit size (no em units) |
| `components/QrScanner.tsx` | M7a | port | ported | `src/features/student/QrScanner.tsx` | d14323f | expo-camera CameraView instead of BarcodeDetector |
| `components/RecordCash.tsx` | M16 | port | ported | `src/features/cash/RecordCashSheet.tsx` | bbc9758 |  |
| `components/ReviewSheet.tsx` | M7a | port | ported | `src/features/channels/ReviewSheet.tsx` | d14323f | built by the M8 session; student Home uses it |
| `components/RunReminder.tsx` | M9b | port | ported | `src/features/staff/RunReminder.tsx` | d14323f |  |
| `components/ShareToChats.tsx` | M8 | port | ported | `src/features/channels/ShareToChats.tsx, src/features/channels/sendToChats.ts` | d14323f | online only; per-chat order kept, stops a chat at its first failure; retries reuse client ids and file paths so nothing is posted twice (the web version could repeat messages on retry) |
| `components/Sidebar.tsx` | skip | skip | skip |  |  | desktop-only / not used on phones |
| `components/SoloCourses.tsx` | M7a | port | ported | `src/features/student/SoloCourses.tsx` | d14323f | (offers, paid-pack notice, centre choice, Paystack in the in-app browser). Mounted on the student home. Pay step is untested against live Paystack; no screenshot pair yet |
| `components/SoloPrices.tsx` | M10b | port | ported | `src/features/admin-classes/SoloPrices.tsx` | d14323f |  |
| `components/Stars.tsx` | M2 | port | ported | `src/ui/Stars.tsx` | 0081e66 |  |
| `components/ui.tsx` | M2 | port | ported | `src/ui/ui.tsx, src/ui/Sheet.tsx, src/ui/SelectSheet.tsx` | 64bc5f7 | Stat compact, StatStrip, Chip, ChipRow added (64bc5f7); Split/Main/Rail single-column on phones |
| `index.css` | M2 | generated | ported | `src/theme/tokens.generated.ts` | d1139f4 |  |
| `lib/auth.tsx` | M3 | port | ported | `src/core/auth.tsx, src/core/session.tsx` | 0081e66 | roles via data layer (cached/offline) + rolesReady |
| `lib/cash.ts` | M16 | port | ported | `src/features/cash/cash.ts, src/features/cash/receiptUpload.ts` | bbc9758 | types/logic in cash.ts; device receipt upload in receiptUpload.ts |
| `lib/centre.ts` | M3 | generated | ported | `src/shared/web/centre.ts` | d1139f4 |  |
| `lib/channels.ts` | M3 | generated | ported | `src/shared/web/channels.ts` | d1139f4 |  |
| `lib/checkin.ts` | M7a | port | ported | `src/shared/checkin.ts, src/features/student/hooks.ts` | d14323f | useCheckedIn is in hooks.ts |
| `lib/classClock.ts` | M7a | port | ported | `src/shared/classClock.ts, src/features/student/hooks.ts` | d14323f | useClassClock is in hooks.ts; M9a/M9b reuse it |
| `lib/db.ts` | M3 | generated | ported | `src/shared/web/db.ts` | d1139f4 |  |
| `lib/doorLock.ts` | M9a | port | ported | `src/features/class/doorLock.ts` | d14323f | pure rules in doorLockCore.ts (unit-tested); AppState background replaces visibilitychange; needsDoorPin re-exported from profile/doorPin |
| `lib/messages.ts` | M8 | port | ported | `src/features/channels/format.ts, src/features/channels/media.ts, src/features/channels/sendToChats.ts, src/shell/TabBar.tsx` | d14323f | copy window, merge, download/share/copy, send to other chats (retry-safe) and the unread count (TabBar) are all native |
| `lib/nav.ts` | M5 | generated | ported | `src/shell/nav.generated.ts` | d1139f4 |  |
| `lib/notifications.ts` | M11a | port | ported | `src/shell/Bell.tsx` | d14323f | unread count (useNotificationCount) is in the shell Bell; live refresh comes from the shared realtime channel's "notifications" tag, no per-screen channel |
| `lib/offline.ts` | M7b | port | ported | `src/shared/offline.ts, src/features/enrol/receipt.ts, src/features/enrol/receiptDevice.ts` | d14323f | prepareReceipt split into pure rules (unit-tested) and the device part |
| `lib/online.ts` | M4a | port | ported | `src/data/net.ts` | 64bc5f7 | NetInfo link + same server probe, 2-strike rule, 20s/4s cadence; pauses in background (ADR-016) |
| `lib/password.ts` | M3 | generated | ported | `src/shared/web/password.ts` | d1139f4 |  |
| `lib/payment.ts` | M7b | port | ported | `src/features/enrol/pay.ts, src/features/enrol/payFlow.ts` | d14323f | pay.ts/payFlow.ts existed from M3; M7b adds verifyPayment (shared by Enrol, OfflinePay, PayCallback) and the return handling: callback_url = WEB_BASE/pay/return + openAuthSessionAsync back to iqacademy://pay/return (ADR-012 amendment). Needs the web /pay/return page deployed first, and a device check on iOS and Android |
| `lib/roster.ts` | M3 | generated | ported | `src/shared/web/roster.ts` | d1139f4 |  |
| `lib/supabase.ts` | M3 | generated | ported | `src/shared/web/errors.ts (MESSAGES, friendly) + src/core/errors.ts` | d1139f4 |  |
| `lib/theme.ts` | M2 | port | ported | `src/theme/ThemeProvider.tsx` | 0081e66 |  |
| `lib/time.ts` | M3 | generated | ported | `src/shared/web/time.ts` | d1139f4 |  |
| `lib/useMedia.ts` | skip | skip | skip |  |  | desktop-only / not used on phones |
| `lib/useStaffCentres.ts` | M9b | port | ported | `src/features/staff/useStaffCentres.ts` | d14323f | branches cached for 10 min so staff screens open offline |
| `lib/verify.ts` | M3 | port | ported | `src/shared/verify.ts` | 0081e66 | localStorage → kv |
| `main.tsx` | M0 | port | ported | `src/app/_layout.tsx` | 0081e66 |  |
| `pages/AdminHome.tsx` | M10a | port | ported | `src/features/admin-people/AdminHome.tsx` | bbc9758 |  |
| `pages/Announce.tsx` | M10a | port | ported | `src/features/admin-people/Announce.tsx` | d14323f | DIFFERS: the pinned "N people will get this / Send" bar is the last card on the page instead of fixed to the bottom |
| `pages/Cash.tsx` | M16 | port | ported | `src/features/cash/Cash.tsx, src/app/(app)/cash.tsx` | bbc9758 | role switch: centre staff or admin view |
| `pages/CashAdmin.tsx` | M16 | port | ported | `src/features/cash/AdminCash.tsx` | bbc9758 | approve/decline behind step-up |
| `pages/CashCentre.tsx` | M16 | port | ported | `src/features/cash/CentreCash.tsx` | bbc9758 | online-only; transfer + PIN hand-over sheets |
| `pages/CentreClasses.tsx` | M9b | port | ported | `src/features/staff/CentreClasses.tsx` | d14323f |  |
| `pages/Centres.tsx` | M10a | port | ported | `src/features/admin-people/Centres.tsx` | d14323f | "use my location" asks foreground location only when tapped; saving the payout bank account needs the M12 step-up (web has none) |
| `pages/ClassChannel.tsx` | M8 | port | ported | `src/features/channels/ClassChannel.tsx, src/shell/ChatFrame.tsx` | d14323f | read, newest page merged + "Show earlier", locked state, mark read (queued), instructor send via outbox with pending bubbles (text and files), selection mode + send to other chats, rating card for students after the class. Composer pinned above keyboard via ChatFrame. Untested on a device; no screenshot pair yet |
| `pages/ClassMessagesAdmin.tsx` | M10a | port | ported | `src/features/channels/ClassMessagesAdmin.tsx, src/features/channels/adminLogic.ts` | d14323f | online only; first page cached, Show older and Delete need a connection; delete also removes the file and still drops the row if only the file removal fails. Owner corrected to M8 (route manifest and plan say M8; M10a left it) |
| `pages/ClassReviews.tsx` | M10a | port | ported | `src/features/admin-people/ClassReviews.tsx` | d14323f |  |
| `pages/ClassScreen.tsx` | M9a | port | ported | `src/features/class/ClassScreen.tsx` | d14323f | online-only writes; attendance from cache on shared realtime tags; class code held in memory only; full-screen door view is a Modal that keeps the screen awake (expo-keep-awake); admin inline chat uses ChatBubble + Composer |
| `pages/CoordinatorHome.tsx` | M9b | port | ported | `src/features/staff/CoordinatorHome.tsx` | bbc9758 | invite QR drawn by react-native-qrcode-svg (JS only); mounts the student ClassCountdown |
| `pages/CourseBuilder.tsx` | M10b | port | ported | `src/features/admin-classes/CourseBuilder.tsx` | d14323f | DIFFERS: the sticky save bar becomes a Save button at the top (when there are changes) and one at the end; read-back-after-save kept |
| `pages/CustomClasses.tsx` | M9b | port | ported | `src/features/staff/CustomClasses.tsx` | d14323f |  |
| `pages/DirectorHome.tsx` | M9b | port | ported | `src/features/staff/DirectorHome.tsx` | bbc9758 | withdraw/cancel are online-only and confirmed; no step-up (web has none; director requests, admin pays) |
| `pages/Enrol.tsx` | M7b | port | ported | `src/features/enrol/Enrol.tsx, src/features/enrol/logic.ts` | bbc9758 | 4 steps with a pinned Back/Continue bar (Screen footer). A retry after a failed or still-confirming payment reuses the registration already made (the web would create another). Paystack not yet run live (keys not configured); no screenshot pair |
| `pages/HandCheckIns.tsx` | M10a | port | ported | `src/features/admin-people/HandCheckIns.tsx` | d14323f |  |
| `pages/InstructorHistory.tsx` | M9a | port | ported | `src/features/class/InstructorHistory.tsx` | d14323f | first page cached; Load more is online-only |
| `pages/InstructorHome.tsx` | M9a | port | ported | `src/features/class/InstructorHome.tsx` | d14323f | cached dashboard; mounts the student ClassCountdown and RunReminder |
| `pages/InstructorMessages.tsx` | M8 | port | ported | `src/features/channels/Messages.tsx` | d14323f | instructor list, chosen by role like web MessagesRoute |
| `pages/InstructorPayouts.tsx` | unassigned | port | diverged | `src/features/admin-money/InstructorPayouts.tsx` | d1139f4 | no date-range earnings explorer: earnings are per instructor (tap a wallet). Send is behind step-up. |
| `pages/Instructors.tsx` | M10a | port | ported | `src/features/admin-people/Instructors.tsx` | d14323f |  |
| `pages/Landing.tsx` | M6 | port | diverged | `src/features/auth/Landing.tsx` | d14323f | web's 'Get the app' / 'Continue on PC' buttons become 'Create an account' / 'Sign in' (already in the app) |
| `pages/Login.tsx` | M6 | port | ported | `src/features/auth/Login.tsx` | d14323f |  |
| `pages/Manage.tsx` | M10a | port | ported | `src/features/admin-people/Manage.tsx` | bbc9758 | counts come from cached queries |
| `pages/Messages.tsx` | M8 | port | ported | `src/features/channels/Messages.tsx` | d14323f | student list (receive-only), cached, live via global realtime + DELETE |
| `pages/MyClasses.tsx` | M9a | port | ported | `src/features/class/MyClasses.tsx` | d14323f | refreshes on the shared sessions and notifications tags instead of a per-screen channel |
| `pages/Notifications.tsx` | M11a | port | ported | `src/features/notifications/Notifications.tsx` | bbc9758 | list kept on the phone and refreshed with changes-since (full reload every 2 min); opening marks read (queued offline); "Show older" pages online only. Not yet: tapping a push to open this screen, app badge. No screenshot pair yet |
| `pages/OfflinePay.tsx` | M7b | port | ported | `src/features/enrol/OfflinePay.tsx, src/features/enrol/receiptDevice.ts` | bbc9758 | receipt from library, camera or PDF; photos shrunk to 1600 px JPEG .82 with ImageManipulator.manipulate (manipulateAsync is deprecated); sent through the upload queue so it works offline and shows on Pending. Not run on a device; no screenshot pair |
| `pages/OfflinePayments.tsx` | M10c | port | ported | `src/features/admin-money/OfflinePayments.tsx` | bbc9758 | approve, decline and "where students pay" need the M12 step-up; receipts via 5-minute signed link |
| `pages/PayCallback.tsx` | M7b | port | ported | `src/features/enrol/PayCallback.tsx` | d14323f | only reached if the OS opens the return page in the app; native does not depend on it (payFlow asks the server). Never claims success without asking |
| `pages/Payments.tsx` | M10c | port | ported | `src/features/admin-money/Payments.tsx` | d1139f4 | refund capped to unused classes (payment_refund_info) |
| `pages/Payouts.tsx` | M10c | port | ported | `src/features/admin-money/Payouts.tsx` | d14323f | "send" needs the M12 step-up; cancelling a draft does not |
| `pages/PayReturn.tsx` | M7b | port | ported | `src/app/(app)/pay/return.tsx, src/features/enrol/payFlow.ts` | 1a13ada | public web page hands back to iqacademy://pay/return; native confirms with the server and never claims success on its own |
| `pages/Prices.tsx` | M10b | port | ported | `src/features/admin-classes/Prices.tsx` | d14323f | rules in pricing.ts (unit-tested) |
| `pages/Profile.tsx` | M13 | port | diverged | `src/features/profile/Profile.tsx` | d14323f | native-only additions: Notifications, Security (M12), Delete my account; photo from the phone library. Interim screen deleted |
| `pages/ResetPassword.tsx` | M6 | port | ported | `src/features/auth/ResetPassword.tsx` | d14323f |  |
| `pages/Roster.tsx` | M10b | port | ported | `src/features/admin-classes/Roster.tsx` | d14323f | reads ?centre= and ?course= from Schedule's deep link |
| `pages/Schedule.tsx` | M9b | port | ported | `src/features/staff/Schedule.tsx` | d14323f | date and time inputs replaced by JS pickers; every change online-only |
| `pages/StaffHome.tsx` | M9b | port | ported | `src/features/staff/StaffHome.tsx` | d14323f |  |
| `pages/Statement.tsx` | M9b | port | ported | `src/features/staff/Statement.tsx` | d14323f | fixes a web quirk: a centre with no months shows an empty state instead of a skeleton forever |
| `pages/StudentHome.tsx` | M7a | port | ported | `src/features/student/Home.tsx` | bbc9758 | rating sheet is the M8 one; pull-to-refresh not wired (shell RoleHome) |
| `pages/Students.tsx` | M9b | port | ported | `src/features/staff/Students.tsx` | d14323f | list is not virtualised (fine to a few hundred rows; revisit if a centre grows past that) |
| `pages/Team.tsx` | M9b | port | ported | `src/features/staff/Team.tsx` | d14323f | online-only role changes; admin lands via a centre card, directors on their own centre |
| `pages/Users.tsx` | M10a | port | ported | `src/features/admin-people/Users.tsx` | d14323f |  |
| `pages/VerifyEmail.tsx` | M6 | port | ported | `src/features/auth/VerifyEmail.tsx` | d14323f |  |
| `pages/Wallet.tsx` | unassigned | port | ported | `src/features/wallet/Wallet.tsx` | d1139f4 | per-month like DirectorHome; display rules in walletUi.ts (tested) |
