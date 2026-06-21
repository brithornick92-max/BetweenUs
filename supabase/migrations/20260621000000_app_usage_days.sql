-- App usage days: one row per user per LOCAL calendar day they opened the app.
-- Supabase Auth's last_sign_in_at only records the last sign-in, and a session
-- stays valid for weeks without the app being opened, so it can't answer
-- "which days did this customer actually use the app?". This tiny table can.
--
-- Written by a cheap idempotent upsert on (user_id, used_on) from the client on
-- app open and on each foreground return (see services/appUsage.js). used_on is
-- the device-LOCAL date, computed on the client, so "used June 18" means the
-- customer's June 18 - not a UTC day that drifts for evening users.
create table if not exists public.app_usage_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  platform text,
  app_version text,
  unique (user_id, used_on)
);

-- The owner-facing daily-active-users rollup reads by day.
create index if not exists app_usage_days_used_on_idx
  on public.app_usage_days (used_on);

alter table public.app_usage_days enable row level security;

-- Users may only write their own usage rows. There is intentionally no SELECT
-- policy: the client never reads this table back. The owner reads it from the
-- dashboard / service role (which bypasses RLS), keeping per-customer usage
-- private from the app itself.
drop policy if exists "app_usage_days_insert_own" on public.app_usage_days;
create policy "app_usage_days_insert_own" on public.app_usage_days
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "app_usage_days_update_own" on public.app_usage_days;
create policy "app_usage_days_update_own" on public.app_usage_days
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
