-- Optional customer notification layer for the existing Supabase project.
-- Admin/trusted server code should insert rows; the browser can only read and
-- mark notifications belonging to the signed-in user as read.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  kind text not null default 'announcement',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

-- Create a welcome notification whenever a new Supabase Auth account is created.
-- SECURITY DEFINER is required because auth.users is managed by Supabase and
-- the browser must not receive permission to insert notification records.
create or replace function public.create_welcome_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, kind)
  values (
    new.id,
    'Welcome to PrivacyGuard',
    'Your PrivacyGuard account is ready. Add or activate a licence to get started.',
    'account_created'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_notification on auth.users;
create trigger on_auth_user_created_notification
  after insert on auth.users
  for each row execute function public.create_welcome_notification();

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;