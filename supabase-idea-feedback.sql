-- ============================================
-- Markedia — Buyer feedback on purchased ideas
-- Run AFTER supabase-update.sql. Safe to re-run.
-- ============================================

-- 1) idea_feedback: a buyer rates how accurate the AI preview was, plus their
--    own 1-10 rating of the idea. One row per (user, idea); upserted.
create table if not exists idea_feedback (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- AI preview accuracy on a 5-point scale:
  -- -2 completely underestimated, -1 slightly underestimated,
  --  0 reported accurately, 1 slightly overestimated, 2 completely overestimated
  accuracy smallint check (accuracy between -2 and 2),
  -- Buyer's own perceived quality of the idea, 1-10
  user_rating smallint check (user_rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idea_id)
);

-- 2) Enable RLS
alter table idea_feedback enable row level security;

-- 3) A user can see, add, update, and remove only their own feedback rows.
drop policy if exists "Users can read own feedback" on idea_feedback;
create policy "Users can read own feedback"
  on idea_feedback for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own feedback" on idea_feedback;
create policy "Users can insert own feedback"
  on idea_feedback for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own feedback" on idea_feedback;
create policy "Users can update own feedback"
  on idea_feedback for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own feedback" on idea_feedback;
create policy "Users can delete own feedback"
  on idea_feedback for delete using (auth.uid() = user_id);

-- 4) Helpful indexes
create index if not exists idea_feedback_idea_idx on idea_feedback(idea_id);
create index if not exists idea_feedback_user_idx on idea_feedback(user_id);
