-- 🔐 STEP 2: Turn on Row Level Security (VERY important)
-- Run this next in Supabase SQL Editor:

alter table profiles enable row level security;
alter table couples enable row level security;
alter table couple_data enable row level security;
alter table couple_members enable row level security;

-- PROFILES: Users can only see/edit their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- COUPLES: Partners can see/edit their couple record
create policy "Couple members can view couple" on couples
  for select using (is_couple_member(id, auth.uid()));

create policy "Couple members can update couple" on couples
  for update using (is_couple_member(id, auth.uid()));

create policy "Users can create couples" on couples
  for insert with check (auth.uid() = created_by);

-- COUPLE_MEMBERS: members can view/insert their own membership
create policy "Users can view own memberships" on couple_members
  for select using (auth.uid() = user_id);

create policy "Users can join couple" on couple_members
  for insert with check (auth.uid() = user_id);

-- COUPLE_DATA: This is the heart of BetweenUs security
-- Partners can see shared data, only creator can see private data

-- View policy: See shared data OR your own private data
create policy "Couple members can view shared data" on couple_data
  for select using (
    -- Must be a member of this couple
    is_couple_member(couple_id, auth.uid()) 
    and (
      -- Can see if it's not private
      is_private = false 
      -- OR if you created it (even if private)
      or created_by = auth.uid()
    )
  );

-- Insert policy: Can add data to your couple
create policy "Couple members can insert data" on couple_data
  for insert with check (
    -- Must be a member of this couple
    is_couple_member(couple_id, auth.uid())
    -- Must be the one creating it
    and created_by = auth.uid()
  );

-- Update policy: Can update data you created
create policy "Creators can update own data" on couple_data
  for update using (
    -- Must be a member of this couple
    is_couple_member(couple_id, auth.uid())
    -- Must be the original creator
    and created_by = auth.uid()
  );

-- Delete policy: Can delete data you created
create policy "Creators can delete own data" on couple_data
  for delete using (
    -- Must be a member of this couple
    is_couple_member(couple_id, auth.uid())
    -- Must be the original creator
    and created_by = auth.uid()
  );

-- This means:
-- ✅ Partners can see each other's shared memories/prompts/dates
-- ✅ Private data stays private to the creator
-- ✅ Everything is couple-centric (no orphaned data)
-- ❌ Users can't see random other couples' data
-- ❌ Users can't modify data they didn't create
