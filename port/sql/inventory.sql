-- port/sql/inventory.sql  (READ-ONLY: SELECTs only)
-- Run through the Supabase connector's execute_sql at the start of a session; diff against port/BACKEND.md and port/CONTRACTS.md.
select json_build_object(
  'extensions',     (select json_agg(extname order by extname) from pg_extension),
  'realtime',       (select json_agg(tablename order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'),
  'public_functions',(select json_agg(proname order by proname) from pg_proc where pronamespace = 'public'::regnamespace and prokind = 'f' and proname !~ '^(rls_|_)'),
  'cron',           (select json_agg(json_build_object('name', jobname, 'schedule', schedule, 'cmd', left(command, 120))) from cron.job),
  'app_settings_keys',(select json_agg(key order by key) from public.app_settings),
  'notification_types',(select json_agg(distinct type) from public.notifications),
  'tables',         (select json_agg(tablename order by tablename) from pg_tables where schemaname = 'public')
) as inventory;
-- Also compare Edge Functions with the connector: list_edge_functions, then get_edge_function for any whose version changed.
