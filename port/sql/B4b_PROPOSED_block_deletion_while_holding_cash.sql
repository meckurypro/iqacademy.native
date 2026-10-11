-- PROPOSED, NOT APPLIED. Needs the owner's go-ahead (a product rule), then the backend session applies it as a migration.
--
-- Why: migration 60 (cash payments, 2026-10-11) lets staff collect cash and pass it up a chain until it is `settled`. `anonymise_account` (B4) refuses admins
-- but not a coordinator/director who has collected cash that is not yet settled; deleting their account would turn the person accountable for that money
-- into "Deleted user". Today there are 0 cash rows and no screen uses the feature, so nothing is at risk yet.
--
-- Rule proposed: refuse deletion (key `holding_cash`) while the person has collected cash that is not settled, or has a remittance waiting for a decision (`cash_pending`).
-- Both are deny-conditions inside `exists (...)`, so a NULL never lets someone through (ADR-018). The rest of the function is unchanged from B4_account_deletion.sql.
create or replace function public.anonymise_account(p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_uid is null or not exists (select 1 from public.profiles where id = p_uid) then raise exception 'not_found'; end if;
  if exists (select 1 from public.user_roles where user_id = p_uid and is_active and role in ('super_admin', 'admin')) then raise exception 'admin_cannot_delete'; end if;
  -- NEW
  if exists (select 1 from public.cash_collections c where c.collected_by = p_uid and c.stage <> 'settled') then raise exception 'holding_cash'; end if;
  if exists (select 1 from public.cash_remittances r where r.submitted_by = p_uid and r.status = 'pending') then raise exception 'cash_pending'; end if;

  delete from public.device_push_tokens where user_id = p_uid;
  delete from public.student_pins where student_id = p_uid;
  delete from public.staff_pins where user_id = p_uid;
  delete from public.notifications where user_id = p_uid;
  delete from public.message_reads where user_id = p_uid;
  delete from public.class_channel_reads where user_id = p_uid;

  update public.profiles set full_name = 'Deleted user', email = 'deleted-' || p_uid::text || '@deleted.invalid', phone = null, avatar_url = null,
         metadata = '{}'::jsonb, is_active = false, deleted_at = coalesce(deleted_at, now()) where id = p_uid;
  update public.students set address = null, occupation = null, referral_source = null, emergency_contact_name = null, emergency_contact_phone = null,
         date_of_birth = null, metadata = '{}'::jsonb where id = p_uid;
  update public.instructor_profiles set bio = null, metadata = '{}'::jsonb where id = p_uid;
  update public.user_roles set is_active = false where user_id = p_uid;
  update public.class_messages set sender_label = 'Former instructor' where sender_id = p_uid;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.anonymise_account(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_account(uuid) to service_role;

-- Refusal test to run after applying (rolled-back block, as the service role the Edge Function uses):
--   do $$ declare s uuid; r text; begin
--     select id into s from public.profiles where id not in (select user_id from public.user_roles where role in ('admin','super_admin')) limit 1;
--     insert into public.cash_collections (payment_id, centre_id, amount, collected_by, stage) select <a payment>, <its centre>, 1000, s, 'at_centre';
--     begin perform public.anonymise_account(s); r := 'ALLOWED(BAD)'; exception when others then r := sqlerrm; end;   -- expect: holding_cash
--     raise exception 'TEST %', r; end $$;
-- Client side (not yet changed): add `holding_cash` / `cash_pending` wording to src/features/profile/deleteAccount.ts `deleteErrorMessage`.
