-- ═══════════════════════════════════════════════════════════════════════════════
-- Supabase Migration: Couple Premium + Usage Events
-- Run in Supabase SQL Editor AFTER supabase-schema.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Add premium columns to couples table ────────────────────────────────────
-- When EITHER partner subscribes, we mark the couple space as premium-enabled.
alter table couples
  add column if not exists is_premium boolean default false,
  add column if not exists premium_since timestamptz,
  add column if not exists premium_source text default 'none'
    check (premium_source in ('none', 'user_a', 'user_b'));

-- Index for fast couple premium lookups
create index if not exists idx_couples_premium on couples(is_premium) where is_premium = true;

-- ─── 2. Usage events table ─────────────────────────────────────────────────────
-- Tracks per-user, per-day consumption events.
-- Enforces daily limits server-side (e.g., 1 prompt/day for free users).
create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  event_type text not null,
  local_day_key text not null,   -- e.g., '2026-02-08'
  metadata jsonb default '{}',   -- optional: prompt_id, date_id, etc.
  created_at timestamptz default now()
);

-- Composite index for the core query: "how many times has this user done X today?"
-- NOTE: NOT unique — each consumption event inserts a new row so count(*) works.
create index if not exists idx_usage_events_daily
  on usage_events(couple_id, user_id, event_type, local_day_key);

create index if not exists idx_usage_events_couple_day
  on usage_events(couple_id, local_day_key);

create index if not exists idx_usage_events_user_day
  on usage_events(user_id, local_day_key);

-- ─── 3. RLS policies for usage_events ───────────────────────────────────────────
alter table usage_events enable row level security;

-- Users can only insert their own events
create policy "Users can insert own usage events"
  on usage_events for insert
  with check (
    auth.uid() = user_id
    and is_couple_member(couple_id, auth.uid())
  );

-- Users can read their couple's events (both partners see shared limits)
create policy "Users can read couple usage events"
  on usage_events for select
  using (is_couple_member(couple_id, auth.uid()));

-- Users can delete their own events (for edge cases / admin)
create policy "Users can delete own usage events"
  on usage_events for delete
  using (auth.uid() = user_id);

-- ─── 4. RLS policies for couples premium fields ─────────────────────────────────
-- Couple members can read their couple's premium status
-- (The existing couples RLS should already allow reading by members,
--  but let's ensure the premium fields are covered)

-- ─── 5. Helper function: check couple premium status ─────────────────────────────
create or replace function get_couple_premium_status(input_couple_id uuid)
returns jsonb as $$
declare
  result jsonb;
begin
  -- Auth guard: caller must be a member of this couple
  if not is_couple_member(input_couple_id, auth.uid()) then
    raise exception 'Access denied: not a member of this couple';
  end if;

  select jsonb_build_object(
    'is_premium', coalesce(c.is_premium, false),
    'premium_since', c.premium_since,
    'premium_source', coalesce(c.premium_source, 'none')
  )
  into result
  from couples c
  where c.id = input_couple_id;

  return coalesce(result, '{"is_premium": false, "premium_source": "none"}'::jsonb);
end;
$$ language plpgsql security definer;

-- ─── 6. Helper function: count daily usage for a user ────────────────────────────
create or replace function get_daily_usage_count(
  input_couple_id uuid,
  input_user_id uuid,
  input_event_type text,
  input_day_key text
)
returns integer as $$
begin
  -- Auth guard: caller must be a member of this couple
  if not is_couple_member(input_couple_id, auth.uid()) then
    raise exception 'Access denied: not a member of this couple';
  end if;

  return (
    select count(*)::integer
    from usage_events
    where couple_id = input_couple_id
      and user_id = input_user_id
      and event_type = input_event_type
      and local_day_key = input_day_key
  );
end;
$$ language plpgsql security definer;

-- ─── 7. Function to set couple premium status ────────────────────────────────────
-- Called when a subscription event occurs (webhook or client-side after purchase)
create or replace function set_couple_premium(
  input_couple_id uuid,
  input_is_premium boolean,
  input_source text default 'none'
)
returns void as $$
begin
  -- Auth guard: caller must be a member of this couple
  if not is_couple_member(input_couple_id, auth.uid()) then
    raise exception 'Access denied: not a member of this couple';
  end if;

  update couples
  set
    is_premium = input_is_premium,
    premium_since = case
      when input_is_premium and premium_since is null then now()
      when not input_is_premium then null
      else premium_since
    end,
    premium_source = input_source,
    updated_at = now()
  where id = input_couple_id;
end;
$$ language plpgsql security definer;

-- ─── 8. Trigger: auto-update profiles.is_premium when couples.is_premium changes ─
-- Keeps profile-level flag in sync for simpler queries
create or replace function sync_couple_premium_to_profiles()
returns trigger as $$
begin
  update profiles
  set is_premium = new.is_premium, updated_at = now()
  where id in (
    select user_id from couple_members where couple_id = new.id
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_sync_couple_premium on couples;
create trigger trigger_sync_couple_premium
  after update of is_premium on couples
  for each row
  when (old.is_premium is distinct from new.is_premium)
  execute function sync_couple_premium_to_profiles();
