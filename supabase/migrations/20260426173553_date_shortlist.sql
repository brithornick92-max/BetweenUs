create table if not exists public.date_shortlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_id text not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz null,

  constraint date_shortlist_user_date_unique unique (user_id, date_id)
);

alter table public.date_shortlist enable row level security;

drop policy if exists "Users can read their own date shortlist" on public.date_shortlist;
create policy "Users can read their own date shortlist"
on public.date_shortlist
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own date shortlist" on public.date_shortlist;
create policy "Users can insert their own date shortlist"
on public.date_shortlist
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own date shortlist" on public.date_shortlist;
create policy "Users can update their own date shortlist"
on public.date_shortlist
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists date_shortlist_user_active_idx
on public.date_shortlist (user_id, created_at desc)
where removed_at is null;
