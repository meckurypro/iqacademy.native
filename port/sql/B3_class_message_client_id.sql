-- B3 (applied 2026-10-09 as migration `57_class_message_client_id`)
-- Makes send_class_message safe to repeat. The app can queue a message while offline and retry after a lost response without posting twice:
-- it sends the same client id every time, and the server returns the message it already stored.
-- Additive: p_client_id defaults to null, so every existing caller (the web app) behaves exactly as before.
-- The old 6-argument function is dropped because two overloads that both accept six named arguments would make PostgREST calls ambiguous.
-- ROLLBACK: recreate the 6-argument function from migration 'class_channels_and_true_reminders'/'channel_any_file' and
--           drop index class_messages_sender_client_uniq; alter table public.class_messages drop column client_id;

alter table public.class_messages add column if not exists client_id uuid;
create unique index if not exists class_messages_sender_client_uniq on public.class_messages (sender_id, client_id) where client_id is not null;

drop function if exists public.send_class_message(uuid, text, text, text, text, integer);

create function public.send_class_message(
  p_session_id uuid, p_body text default null, p_media_path text default null, p_media_name text default null,
  p_media_mime text default null, p_media_size integer default null, p_client_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_s public.class_sessions%rowtype; v_uid uuid := (select auth.uid()); v_body text := nullif(trim(coalesce(p_body, '')), '');
        v_label text := 'IQ Academy'; v_first text; v_id uuid;
begin
  select * into v_s from public.class_sessions where id = p_session_id;
  if not found then raise exception 'session_not_found'; end if;
  if not (private.is_admin() or v_s.instructor_id = v_uid) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- A retry of a message we already stored: hand back the same id (after the permission check above, so it never leaks across people).
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

  if v_id is null then  -- lost a race with a parallel retry: return the winner
    select id into v_id from public.class_messages where sender_id = v_uid and client_id = p_client_id;
  end if;
  return v_id;
end $function$;

revoke all on function public.send_class_message(uuid, text, text, text, text, integer, uuid) from public, anon;
grant execute on function public.send_class_message(uuid, text, text, text, text, integer, uuid) to authenticated, service_role;
