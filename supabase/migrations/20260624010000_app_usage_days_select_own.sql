-- app_usage_days is written with an upsert (INSERT ... ON CONFLICT DO UPDATE,
-- see services/appUsage.js). Under RLS that path must be able to read the
-- conflicting row to resolve the conflict, but the table shipped with NO select
-- policy on purpose - so every upsert was denied with 42501 and the table stayed
-- empty even after the insert/update policies were fixed (20260624000000).
--
-- Add a SELECT policy scoped to the caller's OWN rows. Users can only ever see
-- their own usage days (data they generated themselves), so this is not a
-- privacy regression: other users' rows stay hidden, and the owner-facing
-- cross-user rollup still runs through the service role (which bypasses RLS).

drop policy if exists "app_usage_days_select_own" on public.app_usage_days;
create policy "app_usage_days_select_own" on public.app_usage_days
  for select to authenticated
  using (auth.uid() = user_id);
