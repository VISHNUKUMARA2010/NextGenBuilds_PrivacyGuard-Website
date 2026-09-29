create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  license_key text not null unique,
  status text not null default 'active' check (status in ('active', 'expired')),
  expiry_date timestamptz,
  created_at timestamptz not null default now()
);

alter table public.licenses enable row level security;

drop policy if exists "Users can read their own licenses" on public.licenses;
create policy "Users can read their own licenses"
  on public.licenses for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists licenses_user_id_idx on public.licenses(user_id);

-- Licence keys are created manually by an operator. There is intentionally no
-- auth.users trigger or client insert policy that can generate keys on signup.
drop trigger if exists on_auth_user_created_license on auth.users;
drop function if exists public.create_trial_license();
