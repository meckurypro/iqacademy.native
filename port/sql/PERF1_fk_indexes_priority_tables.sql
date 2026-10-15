-- PERF1 (applied 2026-10-15 as migration `add_fk_indexes_priority_tables`): covering indexes for foreign keys on growing tables
--
-- PROBLEM. Advisor INFO `unindexed_foreign_keys` (lint 0001), 64 findings. Column names were read from pg_constraint/pg_attribute
-- (every one of these FKs is single-column).
-- FIX. 41 btree indexes `<table>_<column>_idx` on the tables that will grow or are joined often. Left unindexed on purpose (tiny/admin
-- tables, 22 findings remain): broadcasts, centre_share_history, certificates, class_channel_reads, custom_class_invites, expenses,
-- instructor_courses, instructor_session_posts, leads, lesson_materials, pathway_courses, payouts, project_submissions,
-- session_checkin_tokens, students, timetable_slots, user_roles. Brief SHARE lock per table; tables are small pre-launch.
-- ROLLBACK. `drop index if exists public.<name>;` for each index below.
-- NOTE. The advisor now lists these as "unused index" until traffic exists: expected, do not drop (ADR-019).

create index if not exists attendance_cohort_id_idx on public.attendance (cohort_id);
create index if not exists attendance_course_id_idx on public.attendance (course_id);
create index if not exists attendance_marked_by_idx on public.attendance (marked_by);
create index if not exists class_sessions_course_id_idx on public.class_sessions (course_id);
create index if not exists class_sessions_lesson_id_idx on public.class_sessions (lesson_id);
create index if not exists class_sessions_completed_by_idx on public.class_sessions (completed_by);
create index if not exists class_sessions_created_by_idx on public.class_sessions (created_by);
create index if not exists checkin_denials_centre_id_idx on public.checkin_denials (centre_id);
create index if not exists checkin_denials_student_id_idx on public.checkin_denials (student_id);
create index if not exists hand_check_ins_session_id_idx on public.hand_check_ins (session_id);
create index if not exists hand_check_ins_student_id_idx on public.hand_check_ins (student_id);
create index if not exists enrolments_package_id_idx on public.enrolments (package_id);
create index if not exists enrolments_registered_by_idx on public.enrolments (registered_by);
create index if not exists enrolment_instalments_payment_id_idx on public.enrolment_instalments (payment_id);
create index if not exists payments_recorded_by_idx on public.payments (recorded_by);
create index if not exists refunds_centre_id_idx on public.refunds (centre_id);
create index if not exists refunds_enrolment_id_idx on public.refunds (enrolment_id);
create index if not exists refunds_requested_by_idx on public.refunds (requested_by);
create index if not exists notifications_broadcast_id_idx on public.notifications (broadcast_id);
create index if not exists instructor_ledger_entries_centre_id_idx on public.instructor_ledger_entries (centre_id);
create index if not exists instructor_ledger_entries_course_id_idx on public.instructor_ledger_entries (course_id);
create index if not exists instructor_ledger_entries_created_by_idx on public.instructor_ledger_entries (created_by);
create index if not exists instructor_ledger_entries_student_id_idx on public.instructor_ledger_entries (student_id);
create index if not exists instructor_pending_earnings_centre_id_idx on public.instructor_pending_earnings (centre_id);
create index if not exists instructor_pending_earnings_course_id_idx on public.instructor_pending_earnings (course_id);
create index if not exists instructor_pending_earnings_enrolment_id_idx on public.instructor_pending_earnings (enrolment_id);
create index if not exists instructor_pending_earnings_instructor_id_idx on public.instructor_pending_earnings (instructor_id);
create index if not exists instructor_pending_earnings_student_id_idx on public.instructor_pending_earnings (student_id);
create index if not exists instructor_withdrawals_created_by_idx on public.instructor_withdrawals (created_by);
create index if not exists instructor_withdrawals_reviewed_by_idx on public.instructor_withdrawals (reviewed_by);
create index if not exists centre_ledger_entries_created_by_idx on public.centre_ledger_entries (created_by);
create index if not exists centre_ledger_entries_refund_id_idx on public.centre_ledger_entries (refund_id);
create index if not exists cash_collections_collected_by_idx on public.cash_collections (collected_by);
create index if not exists cash_remittances_decided_by_idx on public.cash_remittances (decided_by);
create index if not exists cash_remittances_submitted_by_idx on public.cash_remittances (submitted_by);
create index if not exists cash_remittances_to_admin_idx on public.cash_remittances (to_admin);
create index if not exists course_runs_course_id_idx on public.course_runs (course_id);
create index if not exists course_runs_instructor_id_idx on public.course_runs (instructor_id);
create index if not exists class_reviews_centre_id_idx on public.class_reviews (centre_id);
create index if not exists class_reviews_course_id_idx on public.class_reviews (course_id);
create index if not exists class_reviews_instructor_id_idx on public.class_reviews (instructor_id);
create index if not exists class_reviews_student_id_idx on public.class_reviews (student_id);
