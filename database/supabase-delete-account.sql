-- Account self-deletion RPC for BetweenUs
-- Allows an authenticated user to permanently delete their own account.
-- Run this in the Supabase SQL Editor.

-- 1. Clean up couple-related data the user created
-- 2. Remove the user from couple_members
-- 3. Delete the auth user (cascades to profiles)
create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _couple_id uuid;
  _partner_count int;
begin
  -- Find the user's couple (if any)
  select couple_id into _couple_id
  from couple_members
  where user_id = auth.uid()
  limit 1;

  if _couple_id is not null then
    -- Delete couple_data rows this user created
    delete from couple_data
    where couple_id = _couple_id
      and created_by = auth.uid();

    -- Remove this user from the couple
    delete from couple_members
    where couple_id = _couple_id
      and user_id = auth.uid();

    -- If no members remain, remove the couple entirely
    select count(*) into _partner_count
    from couple_members
    where couple_id = _couple_id;

    if _partner_count = 0 then
      -- Delete remaining couple_data (partner's messages, etc.)
      delete from couple_data where couple_id = _couple_id;
      delete from couples where id = _couple_id;
    end if;
  end if;

  -- Delete any other tables referencing auth.users without cascade
  -- (usage_events, user_entitlements, etc.)
  begin
    delete from usage_events where user_id = auth.uid();
  exception when undefined_table then null;
  end;

  begin
    delete from user_entitlements where user_id = auth.uid();
  exception when undefined_table then null;
  end;

  -- Delete the auth user — cascades to profiles automatically
  delete from auth.users where id = auth.uid();
end;
$$;

-- Grant execute to authenticated users only
grant execute on function delete_own_account() to authenticated;
