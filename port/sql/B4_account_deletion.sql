-- B4: in-app account deletion = deactivate + anonymise, keep ledger rows. Applied 2026-10-09 as migration `native_account_deletion`.
-- Called ONLY by the `delete-account` Edge Function (service role), because profiles has a trigger that undoes is_active/deleted_at/email changes made by a normal user session.
-- Kept on purpose: enrolments, payments, refunds, payouts, centre ledger, attendance, certificates, receipts, class messages (relabelled), reviews. They reference the profile id, which stays.
create or replace function public.anonymise_account(p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_uid is null or not exists (select 1 from public.profiles where id = p_uid) then raise exception 'not_found'; end if;
  if exists (select 1 from public.user_roles where user_id = p_uid and is_active and role in ('super_admin', 'admin')) then raise exception 'admin_cannot_delete'; end if;

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
