-- ============================================
-- Markedia — Saved Ideas (wishlist)
-- Run AFTER supabase-update.sql. Safe to re-run.
-- ============================================

-- 1) saved_ideas table: a user bookmarks ideas to decide later
create table if not exists saved_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idea_id uuid not null references ideas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, idea_id)
);

-- 2) Enable RLS
alter table saved_ideas enable row level security;

-- 3) A user can see, add, and remove only their own saves
drop policy if exists "Users can read own saves" on saved_ideas;
create policy "Users can read own saves"
  on saved_ideas for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own saves" on saved_ideas;
create policy "Users can insert own saves"
  on saved_ideas for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saves" on saved_ideas;
create policy "Users can delete own saves"
  on saved_ideas for delete using (auth.uid() = user_id);

-- 4) Helpful indexes
create index if not exists saved_ideas_user_idx on saved_ideas(user_id, created_at desc);
create index if not exists saved_ideas_idea_idx on saved_ideas(idea_id);
