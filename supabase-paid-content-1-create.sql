-- ============================================
-- Markedia — Paid content, step 1 of 2: create and backfill
-- SAFE TO RUN AT ANY TIME. Nothing breaks: the old columns stay in place, so
-- the currently deployed code keeps working while this table is populated.
--
-- WHY THIS EXISTS
-- `ideas` rows are publicly readable so the Market can list them, and RLS is
-- row-level: a policy that exposes a row exposes every column of it. The paid
-- content (problem, solution, differentiator, audience, skills, the AI's
-- per-criterion reasoning) lived on that row, so anyone holding the anon key —
-- which ships inside the browser bundle — could read every published idea in
-- full with one request. There was nothing left to sell.
--
-- The fix is structural rather than a policy tweak: the paid content moves to
-- its own table whose policies admit only the author and confirmed buyers.
-- Afterwards `select *` on `ideas` is safe by construction, and a column added
-- to `ideas` later cannot leak by accident.
--
-- evaluated_snapshot moves too: it embeds a copy of form_data, so leaving it
-- behind would have kept the hole open.
-- ============================================

create table if not exists idea_details (
  idea_id uuid primary key references ideas(id) on delete cascade,
  form_data jsonb not null default '{}',
  reasonings jsonb,
  evaluated_snapshot jsonb,
  updated_at timestamptz not null default now()
);

alter table idea_details enable row level security;

-- The author always sees their own work.
drop policy if exists "Authors read own idea details" on idea_details;
create policy "Authors read own idea details" on idea_details for select
  using (exists (select 1 from ideas i where i.id = idea_details.idea_id and i.user_id = auth.uid()));

-- Buyers see what they paid for, and keep it even if the listing is later
-- unpublished, archived, or secured by someone else.
drop policy if exists "Buyers read purchased idea details" on idea_details;
create policy "Buyers read purchased idea details" on idea_details for select
  using (exists (select 1 from purchases p where p.idea_id = idea_details.idea_id and p.buyer_id = auth.uid()));

-- Only the author writes.
drop policy if exists "Authors insert own idea details" on idea_details;
create policy "Authors insert own idea details" on idea_details for insert
  with check (exists (select 1 from ideas i where i.id = idea_details.idea_id and i.user_id = auth.uid()));

drop policy if exists "Authors update own idea details" on idea_details;
create policy "Authors update own idea details" on idea_details for update
  using (exists (select 1 from ideas i where i.id = idea_details.idea_id and i.user_id = auth.uid()));

drop policy if exists "Authors delete own idea details" on idea_details;
create policy "Authors delete own idea details" on idea_details for delete
  using (exists (select 1 from ideas i where i.id = idea_details.idea_id and i.user_id = auth.uid()));

-- Copy the existing content across. Re-runnable.
insert into idea_details (idea_id, form_data, reasonings, evaluated_snapshot)
select id, coalesce(form_data, '{}'::jsonb), reasonings, evaluated_snapshot
from ideas
on conflict (idea_id) do nothing;
