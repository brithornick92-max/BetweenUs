-- ═══════════════════════════════════════════════════════════════
-- SUPABASE PREMIUM-AWARE RLS — Between Us
-- Adds server-side premium enforcement to couple_data inserts.
-- Run AFTER supabase-schema.sql and supabase-rls.sql.
-- ═══════════════════════════════════════════════════════════════

-- 1. Helper: Check if the current user has is_premium = true
create or replace function is_user_premium()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_premium from profiles where id = auth.uid()),
    false
  );
$$;

-- 2. Helper: Count how many couple_data rows a user has of a given type
create or replace function user_data_count(p_couple_id uuid, p_data_type text)
returns bigint
language sql
security definer
stable
as $$
  select count(*)
  from couple_data
  where couple_id = p_couple_id
    and data_type = p_data_type
    and created_by = auth.uid();
$$;

-- 3. Premium-gated data types and their free-tier limits.
--    Non-premium users are limited; premium users have no limit.
--
--    data_type       | free limit | notes
--    ────────────────┼────────────┼──────────────────────────
--    memory          | 10         | Relationship memories
--    custom_ritual   | 2          | Custom ritual flows
--    love_note       | 20         | Love notes synced to cloud
--    journal         | unlimited  | Journals are always allowed
--    prompt_answer   | unlimited  | Prompt answers are always allowed
--    check_in        | unlimited  | Check-ins are always allowed

-- 4. Replace the existing insert policy with a premium-aware one.
--    Drop the old policy first (safe even if it doesn't exist).
drop policy if exists "Couple members can insert data" on couple_data;

create policy "Couple members can insert data (premium-aware)" on couple_data
  for insert with check (
    -- Must be a member of this couple
    is_couple_member(couple_id, auth.uid())
    -- Must be the one creating it
    and created_by = auth.uid()
    -- Premium check: either user is premium, or data_type is ungated, or under free limit
    and (
      is_user_premium()
      or data_type in ('journal', 'prompt_answer', 'check_in', 'vibe', 'couple_state')
      or (data_type = 'memory'        and user_data_count(couple_id, 'memory')        < 10)
      or (data_type = 'custom_ritual'  and user_data_count(couple_id, 'custom_ritual')  < 2)
      or (data_type = 'love_note'      and user_data_count(couple_id, 'love_note')      < 20)
    )
  );

-- 5. Index to make the count queries fast
create index if not exists idx_couple_data_type_user
  on couple_data (couple_id, data_type, created_by);

-- 6. Keep profiles.is_premium in sync with your app.
--    When RevenueCat webhook fires or app syncs entitlements,
--    call this from your edge function / server:
--
--    update profiles set is_premium = true where id = '<user_id>';
--
--    Or create a Supabase Edge Function that RevenueCat calls.

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION: Test the policy
-- ═══════════════════════════════════════════════════════════════
-- As a non-premium user, try inserting 11 memories:
--   The 11th should fail with a policy violation.
-- As a premium user, all inserts should succeed.
