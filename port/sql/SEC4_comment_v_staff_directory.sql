-- SEC4 (applied 2026-10-15 as migration `comment_v_staff_directory_security_definer`): document why public.v_staff_directory is SECURITY DEFINER
--
-- PROBLEM. Advisor ERROR `security_definer_view` (lint 0010) on public.v_staff_directory. It is intentional: the view exposes only
-- id, full_name, avatar_url (verified against pg_attribute) of staff, and v_course_runs / v_session_details depend on it so students
-- see instructor names without rights on profiles or user_roles. security_invoker would blank instructor names for every student.
-- FIX. No behaviour change; a COMMENT ON VIEW records the reason. The advisor finding stays open by design.
-- ROLLBACK. comment on view public.v_staff_directory is null;

comment on view public.v_staff_directory is
  'INTENTIONALLY SECURITY DEFINER (advisor 0010 is a known, accepted finding). Exposes only id, full_name, avatar_url of staff to signed-in users. v_course_runs and v_session_details depend on it so students can see instructor names without any rights on profiles or user_roles. Switching it to security_invoker would blank instructor names for every student. Do not add columns without a security review.';
