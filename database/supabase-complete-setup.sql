-- 🚀 COMPLETE SUPABASE SETUP FOR BETWEENUS
-- Run this entire script in Supabase SQL Editor → New query → Paste → Run

-- ✅ STEP 1: Create Tables
-- Profiles for each user (minimal - just premium status and preferences)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  is_premium boolean default false,
  preferences jsonb default '{}',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Couples - the heart of BetweenUs (everything belongs to a couple)
create table couples (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users not null,
  relationship_start_date date,
  couple_name text,
  is_active boolean default true,
  preferences jsonb default '{}',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  role text default 'member',
  created_at timestamp default now(),
  unique(couple_id, user_id)
);

-- All shared couple data (prompts, memories, dates, settings, etc.)
-- This is where EVERYTHING lives - it's all couple-centric
create table couple_data (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  key text not null, -- "memory_123", "prompt_answer_456", "date_idea_789"
  value jsonb, -- plaintext (non-sensitive)
  encrypted_value text, -- encrypted payload (sensitive)
  data_type text not null, -- "memory", "prompt_answer", "date_idea", "setting"
  created_by uuid references auth.users not null, -- which partner created it
  is_private boolean default false, -- visible to partner or not
  tags text[] default '{}', -- for filtering/searching
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Daily usage tracking (still per-user for freemium limits)

-- ✅ STEP 2: Create Indexes for Performance
create index idx_profiles_email on profiles(email);
create index idx_profiles_premium on profiles(is_premium);

create index idx_couples_created_by on couples(created_by);
create index idx_couples_active on couples(is_active);
create index idx_couple_members_couple on couple_members(couple_id);
create index idx_couple_members_user on couple_members(user_id);

create index idx_couple_data_couple_id on couple_data(couple_id);
create index idx_couple_data_key on couple_data(key);
create index idx_couple_data_type on couple_data(data_type);
create index idx_couple_data_created_by on couple_data(created_by);
create index idx_couple_data_private on couple_data(is_private);
create index idx_couple_data_created_at on couple_data(created_at desc);


-- ✅ STEP 3: Create Helper Functions
-- Helper function to get couple ID for a user
create or replace function get_user_couple_id(input_user_id uuid)
returns uuid as $$
begin
  return (
    select couple_id from couple_members
    where user_id = input_user_id
    limit 1
  );
end;
$$ language plpgsql security definer;

-- Helper function to check if user is part of couple
create or replace function is_couple_member(couple_uuid uuid, user_uuid uuid)
returns boolean as $$
begin
  return exists(
    select 1 from couple_members
    where couple_id = couple_uuid
    and user_id = user_uuid
  );
end;
$$ language plpgsql security definer;

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ✅ STEP 4: Create Triggers for Auto-updating Timestamps
create trigger update_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

create trigger update_couples_updated_at
  before update on couples
  for each row execute function update_updated_at_column();

create trigger update_couple_data_updated_at
  before update on couple_data
  for each row execute function update_updated_at_column();


-- 🔐 STEP 5: Enable Row Level Security (VERY IMPORTANT!)
alter table profiles enable row level security;
alter table couples enable row level security;
alter table couple_data enable row level security;
alter table couple_members enable row level security;

-- ✅ STEP 6: Create Security Policies

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

-- 🎉 SETUP COMPLETE!
-- Your BetweenUs database is now ready with:
-- ✅ Couple-centric data model
-- ✅ Row Level Security enabled
-- ✅ Proper indexes for performance
-- ✅ Helper functions for easy queries
-- ✅ Auto-updating timestamps

-- Next steps:
-- 1. Test your app - free users will use local storage
-- 2. Premium users will sync to this Supabase database
-- 3. All data is secure and couple-centric!
