-- Fix: app_usage_days had RLS enabled in prod but the insert/update policies
-- from 20260621000000 never landed (the table was pushed before the policies
-- were added to that migration file, and db push won't re-run an already-applied
-- version). Result: every authenticated write was denied with 42501, so the
-- table stayed empty even on builds that ship services/appUsage.js.
--
-- Re-assert the intended policies idempotently. Still no SELECT policy on
-- purpose: the client only ever writes; the owner reads via the service role.

alter table public.app_usage_days enable row level security;

drop policy if exists "app_usage_days_insert_own" on public.app_usage_days;
create policy "app_usage_days_insert_own" on public.app_usage_days
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "app_usage_days_update_own" on public.app_usage_days;
create policy "app_usage_days_update_own" on public.app_usage_days
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
