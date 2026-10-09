-- B1: device push tokens. Additive only: a new table and two functions. Nothing existing is touched.
-- Applied to the live project "IQ Academy App" on 2026-10-09 as migration `native_device_push_tokens`.
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  app_version text,
  local_reminders boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists device_push_tokens_user_idx on public.device_push_tokens (user_id);
alter table public.device_push_tokens enable row level security;

-- A person can read their own tokens (to show "this device"); every write goes through the two functions below.
create policy device_push_tokens_select_own on public.device_push_tokens for select to authenticated using (user_id = (select auth.uid()));

-- Register or refresh this device. A token that was last used by someone else (shared phone, new login) moves to the current user.
create or replace function public.register_push_token(p_token text, p_platform text, p_device_name text default null, p_app_version text default null, p_local_reminders boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' or char_length(p_token) > 200 then raise exception 'invalid_push_token'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'invalid_push_token'; end if;
  insert into public.device_push_tokens (user_id, expo_push_token, platform, device_name, app_version, local_reminders)
  values (v_uid, p_token, p_platform, left(p_device_name, 100), left(p_app_version, 40), coalesce(p_local_reminders, true))
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id, platform = excluded.platform, device_name = excluded.device_name,
        app_version = excluded.app_version, local_reminders = excluded.local_reminders, last_seen_at = now();
end $$;

-- Forget this device (sign-out). Only removes the caller's own row.
create or replace function public.unregister_push_token(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.device_push_tokens where expo_push_token = p_token and user_id = (select auth.uid());
end $$;

revoke all on function public.register_push_token(text, text, text, text, boolean) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text, text, boolean) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant select on public.device_push_tokens to authenticated;
