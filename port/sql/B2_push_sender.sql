-- B2: push sender. Applied to the live project on 2026-10-09 as migration `native_push_sender`. Edge Function: `send-push` (verify_jwt false, shared secret).
create extension if not exists pg_net;

-- One shared secret, created once. The trigger sends it; the Edge Function reads it back through the service-role-only RPC below and compares.
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'push_webhook_secret', 'Shared secret between the notifications trigger and the send-push Edge Function')
where not exists (select 1 from vault.secrets where name = 'push_webhook_secret');

create or replace function public.get_push_webhook_secret() returns text
language sql security definer set search_path = '' stable as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret'
$$;
revoke all on function public.get_push_webhook_secret() from public, anon, authenticated;
grant execute on function public.get_push_webhook_secret() to service_role;

-- Fire the sender for new in-app notifications of people who have a registered device. Never blocks or fails the insert that caused it.
create or replace function private.notify_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.channel <> 'in_app' or coalesce(new.send_after, now()) > now() then return new; end if;
  if not exists (select 1 from public.device_push_tokens where user_id = new.user_id) then return new; end if;
  begin
    perform net.http_post(
      url := 'https://hwphintmgluqfhtljadg.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret')),
      body := jsonb_build_object('notification_id', new.id),
      timeout_milliseconds := 5000);
  exception when others then
    raise warning 'push trigger failed: %', sqlerrm;
  end;
  return new;
end $$;
revoke all on function private.notify_push() from public, anon, authenticated;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push after insert on public.notifications for each row execute function private.notify_push();
