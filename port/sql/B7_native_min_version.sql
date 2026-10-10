-- B7 (applied 2026-10-09 as migration `56_native_min_version`)
-- The native app reads this at launch and shows a "please update" screen when its version is lower.
-- app_settings is already readable by everyone (policy settings_select = true) and writable by admins only, so no new RPC is needed.
-- Raise the numbers to force an update; leave at 1.0.0 until a build must be retired.
-- ROLLBACK: delete from public.app_settings where key = 'min_native_version';
insert into public.app_settings (key, value, description)
values ('min_native_version', '{"ios":"1.0.0","android":"1.0.0"}'::jsonb,
        'Oldest native app version allowed to run, per platform. Raise it to force an update. The app checks it at launch.')
on conflict (key) do nothing;
