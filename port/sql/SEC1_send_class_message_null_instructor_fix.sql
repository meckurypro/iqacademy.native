-- SEC1 (applied 2026-10-09 as migration `58_send_class_message_null_instructor_fix`): security fix found while testing B3
-- BUG (pre-existing, present in every earlier version of send_class_message):
--     if not (private.is_admin() or v_s.instructor_id = v_uid) then raise exception 'forbidden' ...
--   When a session has NO instructor assigned, `instructor_id = v_uid` is NULL, so `false OR NULL` is NULL and `NOT NULL` is NULL:
--   the IF is not taken and the permission check is silently skipped. Any signed-in user could then post into an active,
--   instructor-less class, labelled "Instructor <their first name>" (reproduced with a plain student account in a rolled-back test).
-- FIX: treat NULL as "not the instructor", and refuse when there is no signed-in user.
-- ROLLBACK: re-apply migration 57 (restores the previous body).
create or replace function public.send_class_message(
  p_session_id uuid, p_body text default null, p_media_path text default null, p_media_name text default null,
  p_media_mime text default null, p_media_size integer default null, p_client_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_s public.class_sessions%rowtype; v_uid uuid := (select auth.uid()); v_body text := nullif(trim(coalesce(p_body, '')), '');
        v_label text := 'IQ Academy'; v_first text; v_id uuid;
begin
  select * into v_s from public.class_sessions where id = p_session_id;
  if not found then raise exception 'session_not_found'; end if;
  if v_uid is null or not (private.is_admin() or coalesce(v_s.instructor_id = v_uid, false)) then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_client_id is not null then
    select id into v_id from public.class_messages where sender_id = v_uid and client_id = p_client_id;
    if found then return v_id; end if;
  end if;

  if v_s.status = 'cancelled' or not (v_s.status in ('in_progress', 'completed') or v_s.checkin_opened_at is not null) then
    raise exception 'session_not_active';
  end if;
  if v_body is null and p_media_path is null then raise exception 'message_empty'; end if;
  if char_length(coalesce(v_body, '')) > 4000 then raise exception 'message_too_long'; end if;
  if p_media_path is not null and (
       p_media_path not like p_session_id::text || '/%'
       or p_media_mime is null or p_media_mime !~ '^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$' or char_length(p_media_mime) > 127
       or coalesce(p_media_size, 0) > 26214400) then raise exception 'invalid_media'; end if;
  if not private.is_admin() then
    select nullif(split_part(trim(full_name), ' ', 1), '') into v_first from public.profiles where id = v_uid;
    v_label := 'Instructor ' || coalesce(v_first, '');
  end if;

  insert into public.class_messages (session_id, sender_id, sender_label, body, media_path, media_name, media_mime, media_size, client_id)
  values (p_session_id, v_uid, trim(v_label), v_body, p_media_path, left(p_media_name, 200), p_media_mime, p_media_size, p_client_id)
  on conflict (sender_id, client_id) where client_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.class_messages where sender_id = v_uid and client_id = p_client_id;
  end if;
  return v_id;
end $function$;
