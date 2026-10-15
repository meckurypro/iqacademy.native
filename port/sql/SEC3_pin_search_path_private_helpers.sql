-- SEC3 (applied 2026-10-15 as migration `pin_search_path_private_helpers`): pin search_path on 6 private helper functions
--
-- PROBLEM. Advisor WARN `function_search_path_mutable` (lint 0011) on private.block_mutation, fmt_naira, is_privileged,
-- jsonb_uuid_array, set_updated_at, try_uuid. A mutable search_path lets a caller who can create objects in an earlier schema
-- shadow the built-ins these functions use.
-- FIX. `set search_path = ''`. All six are SECURITY INVOKER and use only pg_catalog built-ins (to_char, trim, current_setting,
-- jsonb_*, now(), uuid cast), which resolve with an empty path. Bodies are unchanged.
-- ROLLBACK.
--   alter function private.block_mutation()              reset search_path;
--   alter function private.fmt_naira(bigint)             reset search_path;
--   alter function private.is_privileged()               reset search_path;
--   alter function private.jsonb_uuid_array(jsonb, text) reset search_path;
--   alter function private.set_updated_at()              reset search_path;
--   alter function private.try_uuid(text)                reset search_path;
-- TESTED (one rolled-back DO block ending in `raise exception 'TEST_RESULT'`, nothing persisted):
--   fmt_naira(150000) = ₦1,500.00; try_uuid('x') is null, valid uuid parses; jsonb_uuid_array works and returns null for [];
--   is_privileged() true as postgres, false after `set local role authenticated`;
--   UPDATE on app_settings with a manual updated_at: trigger overrode it (set_updated_at works);
--   TRUNCATE on instructor_ledger_entries refused: "instructor_ledger_entries is append-only; add a correcting entry instead" (42501).
--   (the ledger is empty today, so the append-only check used the TRUNCATE trigger, which fires before any row is touched.)

alter function private.block_mutation()               set search_path = '';
alter function private.fmt_naira(bigint)              set search_path = '';
alter function private.is_privileged()                set search_path = '';
alter function private.jsonb_uuid_array(jsonb, text)  set search_path = '';
alter function private.set_updated_at()               set search_path = '';
alter function private.try_uuid(text)                 set search_path = '';
