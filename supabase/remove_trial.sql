-- Run once in Supabase SQL Editor after removing free trials.
-- Existing trial records become expired; delete them instead if preferred.

alter table public.licenses
  drop constraint if exists licenses_status_check;

update public.licenses
set status = 'expired'
where status = 'trial';

alter table public.licenses
  alter column status set default 'active';

alter table public.licenses
  add constraint licenses_status_check
  check (status in ('active', 'expired'));

-- Remove the old automatic trial trigger, if it was previously installed.
drop trigger if exists on_auth_user_created_license on auth.users;
drop function if exists public.create_trial_license();

-- From this point forward, licence keys must be inserted manually by an operator.
