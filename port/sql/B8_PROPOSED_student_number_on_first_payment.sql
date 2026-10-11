-- PROPOSED, NOT APPLIED. Needs the owner's go-ahead (a product rule), then the backend session applies it as a migration (next free number: 57-60 are taken, and two
-- unnumbered `instructor_wallet_*` migrations landed on 2026-10-11, so number it when applying).
--
-- Rule (owner, 2026-10-11): a new account must NOT get a registration number until the person pays for a program.
-- Today `students.student_number` is a column default, so the sign-up trigger (`handle_new_user` inserts the students row) hands every new account a number at once and every
-- abandoned sign-up uses one up. Live check 2026-10-11: 9 students, all numbered, 1 has ever paid, sequence at 17.
--
-- Verified 2026-10-11 against the live schema in a transaction that was rolled back (nothing persisted; production re-checked afterwards): a new account has no number;
-- a first payment activating an enrolment issues one; the same from a NON-privileged session (a centre coordinator confirming cash, role GUC `authenticated`, not admin) still
-- issues it (without the flag in step 3 `trg_students_protect` would silently revert it); a student still cannot set their own number; a second call changes nothing.
-- The live bodies of `on_enrolment_activated` and `protect_student_fields` were identical to the copies below (plus the marked lines) when this was written; the new
-- `trg_payments_instructor_release` trigger is on `payments` and is not touched. Re-compare both bodies to the live ones before applying.
--
-- NOT changed on purpose: the 8 numbers already issued to people who never paid stay (they may have been given out, and hand check-in compares them); decide separately
-- whether to clear them. The sequence is not reset. Nothing else reads the number as non-null: the staff lists already show "No number yet" and the profile card hides when empty.
--
-- Cash payments (migration 60) end in the same place (`apply_payment_effects` marks instalment 1 paid and moves the enrolment pending_payment -> active), so they get a number too.

-- A registration number (students.student_number, e.g. IQA-26-00001) is now issued when the student's FIRST enrolment becomes active
-- (their first payment is confirmed: Paystack, an offline payment an admin confirmed, or cash at a centre). It used to be a column default,
-- so every sign-up got a number at once, and every abandoned sign-up used one up.
--
-- Why a trigger on enrolments and not on payments: apply_payment_effects is the one place every payment channel ends up, and it moves the enrolment
-- pending_payment -> active; on_enrolment_activated already fires on exactly that move. A second (INSERT) trigger covers an enrolment that is created
-- already active (an admin-created one), so "has an active enrolment" always means "has a number".
--
-- Not changed on purpose: numbers that were already issued stay as they are (they may have been given out; hand check-in checks them), and the sequence
-- is not reset (numbers must stay unique, and a gap is harmless).

-- 1. New accounts no longer get a number. (The column was already nullable; nothing reads it as non-null: the staff lists show "No number yet".)
alter table public.students alter column student_number drop default;

-- 2. The one place a number is made: same format as before.
create or replace function private.next_student_number() returns text
language sql volatile security definer set search_path = ''
as $$ select 'IQA-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.student_number_seq')::text, 5, '0') $$;

-- 3. Give a student their number if they have none yet. Safe to call twice: it only touches a student whose number is empty (and only then uses up a number).
--    trg_students_protect resets student_number for anyone who is not privileged/admin, and a centre coordinator confirming a cash payment is neither,
--    so this sets a transaction-local flag that the protection trigger honours for exactly this one change.
create or replace function private.issue_student_number(p_student uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare v text;
begin
  perform set_config('iqa.issuing_student_number', 'on', true);
  update public.students set student_number = private.next_student_number()
   where id = p_student and student_number is null
  returning student_number into v;
  perform set_config('iqa.issuing_student_number', '', true);
  return v; -- null when they already had one
end $$;
revoke all on function private.issue_student_number(uuid) from public, anon, authenticated;
revoke all on function private.next_student_number() from public, anon, authenticated;

create or replace function private.protect_student_fields() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not (private.is_privileged() or private.is_admin()) then
    -- the only change anyone else's session may cause: the FIRST number, made by private.issue_student_number (it sets the flag for its own statement)
    if not (old.student_number is null and coalesce(current_setting('iqa.issuing_student_number', true), '') = 'on') then
      new.student_number := old.student_number;
    end if;
    new.status := old.status;
  end if;
  return new;
end $$;

-- 4. Issue it when the first enrolment becomes active. (Body is the live definition plus the one `perform private.issue_student_number` line.)
create or replace function private.on_enrolment_activated() returns trigger
language plpgsql security definer set search_path = ''
as $function$
declare v_title text; v_date date; v_dirs uuid[]; v_name text; v_pack text; v_weeks integer;
begin
  if new.status = 'active' and old.status = 'pending_payment' then
    perform private.issue_student_number(new.student_id);
    if new.starts_on is null or new.starts_on < (now() at time zone 'Africa/Lagos')::date then
      perform private.set_enrolment_clock(new.id, false);
    end if;
    select starts_on into v_date from public.enrolments where id = new.id;
    select c.title into v_title from public.enrolment_courses ec join public.courses c on c.id = ec.course_id
     where ec.enrolment_id = new.id and ec.sequence_no = 1;
    perform private.notify(array[new.student_id], 'enrolment_active', 'You''re in',
      case when v_date is null then 'Your place is secured. We will tell you your first class date as soon as it is set.'
           else 'Your first class is ' || coalesce(v_title, 'on') || ' at ' || private.centre_place(new.centre_id) || ', ' || to_char(v_date, 'Dy DD Mon') || '.' end,
      jsonb_build_object('enrolment_id', new.id, 'starts_on', v_date));

    select array_agg(r.user_id) into v_dirs from public.user_roles r
     where r.centre_id = new.centre_id and r.role = 'centre_director' and r.is_active;
    select p.full_name into v_name from public.profiles p where p.id = new.student_id;
    select pk.name, pk.duration_weeks into v_pack, v_weeks from public.packages pk where pk.id = new.package_id;
    perform private.notify(v_dirs, 'centre_enrolment', 'New student enrolled',
      coalesce(v_name, 'A student') || ' joined' || coalesce(' the ' || v_pack, '') || coalesce(' (' || v_weeks || ' weeks)', '') || '.',
      jsonb_build_object('enrolment_id', new.id, 'centre_id', new.centre_id));
  end if;
  return null;
end $function$;

-- 5. An enrolment created already active (for example by an admin) also gets its student a number.
create or replace function private.trg_enrolment_number_on_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin perform private.issue_student_number(new.student_id); return null; end $$;
revoke all on function private.trg_enrolment_number_on_insert() from public, anon, authenticated;

drop trigger if exists trg_enrolment_number_on_insert on public.enrolments;
create trigger trg_enrolment_number_on_insert after insert on public.enrolments
  for each row when (new.status in ('active', 'completed')) execute function private.trg_enrolment_number_on_insert();

-- ============ DRY RUN (optional): paste everything ABOVE, then this, into ONE execute_sql call that starts with `begin;`. It ends with a deliberate error that carries the results back,
-- ============ which aborts the transaction, so nothing persists. It swaps the number generator for a throwaway inside the transaction so the real sequence is never used.
-- create or replace function private.next_student_number() returns text language sql volatile as $q$ select 'IQA-DRY-' || substr(md5(random()::text),1,6) $q$;
-- create or replace function public.__dry_issue(p uuid) returns text language plpgsql security definer set search_path = '' as $q$ begin return private.issue_student_number(p); end $q$;
-- create temp table t_res(k text, v text);
-- do $t$
-- declare u uuid := gen_random_uuid(); n text; e0 uuid; s0 uuid; r text; role_during text; priv boolean;
-- begin
--   insert into auth.users (id, aud, role, email, raw_user_meta_data) values (u, 'authenticated', 'authenticated', 'dryrun-' || u || '@example.invalid', '{"full_name":"Dry Run"}');
--   select student_number into n from public.students where id = u;                                   insert into t_res values ('A_new_account_has_number (want NULL)', coalesce(n, 'NULL'));
--   select e.id, e.student_id into e0, s0 from public.enrolments e where e.status = 'pending_payment' limit 1;
--   update public.students set student_number = null where id = s0;
--   update public.enrolments set status = 'active', activated_at = now() where id = e0;
--   select student_number into n from public.students where id = s0;                                  insert into t_res values ('B_after_activation (want a number)', coalesce(n, 'NULL (BAD)'));
--   execute 'set local role authenticated'; perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
--   role_during := current_setting('role'); priv := private.is_privileged() or private.is_admin(); r := public.__dry_issue(u); execute 'reset role';
--   select student_number into n from public.students where id = u;                                  insert into t_res values ('C_non_privileged (want authenticated/false/number)', role_during || '/' || priv || '/' || coalesce(n, 'NULL (BAD)'));
--   execute 'set local role authenticated'; perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
--   update public.students set student_number = 'HACK-1' where id = u; execute 'reset role';
--   select student_number into n from public.students where id = u;                                  insert into t_res values ('D_student_can_set_own (want false)', (n = 'HACK-1')::text);
--   r := public.__dry_issue(u);                                                                       insert into t_res values ('E_second_call (want NULL)', coalesce(r, 'NULL'));
--   raise exception 'DRYRUN_RESULT %', (select jsonb_pretty(jsonb_object_agg(k, v)) from t_res);
-- end $t$;
