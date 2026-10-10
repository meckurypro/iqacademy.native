-- SEC2 (applied 2026-10-10 as migration `59_close_null_instructor_permission_gap`): permission gap in nine functions, found while testing B3
--
-- THE BUG. Each of these functions starts with a gate of this shape:
--     if not (private.is_admin() or v_s.instructor_id = v_uid [or private.is_centre_staff(...)]) then raise exception 'forbidden' ...
-- When a class has NO instructor assigned, `instructor_id = v_uid` is NULL, so `false OR NULL OR false` is NULL and `NOT NULL` is NULL.
-- An IF whose condition is NULL is not taken: the gate is silently skipped and the function carries on for ANY signed-in user.
-- Reproduced with a plain student account on an unassigned, active class (every call rolled back):
--   complete_session, session_attendance_roster, session_denied_attempts(emergency)  -> ran to completion
--   cancel_session, end_class_early, mark_attendance, custom_class_students, custom_class_assert_editable, generate_checkin_token(emergency)
--                                                                                     -> gate bypassed (stopped only by later input checks)
-- so any student could complete or cancel an unassigned class, mark attendance, and read its roster.
--
-- THE FIX. Treat "no instructor" as "not the instructor": wrap the comparison in coalesce(..., false). Nothing else changes: each function is
-- rewritten from its own live definition (ownership, SECURITY DEFINER, search_path and grants are preserved by CREATE OR REPLACE),
-- and the migration aborts (so nothing is applied) if any function is missing, overloaded, or does not change.
-- send_class_message had the same bug and was fixed separately in migration 58.
--
-- Not changed (they fail closed): WHERE-clause filters such as class_channel_messages / custom_classes_overview, and checks built on exists().
-- ROLLBACK: none needed for behaviour; to restore the old (buggy) text, re-create the functions from migrations
--   door_check_in, hand_check_in_window_and_coordinator_scope, custom_classes, emergency_classes, end_reason_cohort_lock_reviews.
do $m$
declare f record; d text; nd text; n int := 0;
begin
  for f in
    select p.oid, ns.nspname, p.proname
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where (ns.nspname, p.proname) in (
       ('public','cancel_session'), ('public','complete_session'), ('public','custom_class_students'), ('public','end_class_early'),
       ('public','generate_checkin_token'), ('public','mark_attendance'), ('public','session_attendance_roster'),
       ('public','session_denied_attempts'), ('private','custom_class_assert_editable'))
  loop
    d := pg_get_functiondef(f.oid);
    nd := regexp_replace(d,  'v_s\.instructor_id = \(select auth\.uid\(\)\)', 'coalesce(v_s.instructor_id = (select auth.uid()), false)', 'g');
    nd := regexp_replace(nd, 'v_s\.instructor_id = v_uid',                    'coalesce(v_s.instructor_id = v_uid, false)',               'g');
    if nd = d then raise exception 'SEC2: % . % did not change', f.nspname, f.proname; end if;
    execute nd;
    n := n + 1;
  end loop;
  if n <> 9 then raise exception 'SEC2: expected to patch 9 functions, patched %', n; end if;
end $m$;
