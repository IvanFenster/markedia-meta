-- ============================================
-- Markedia DB fix migration
-- Run this in the Supabase SQL editor.
-- Safe to re-run.
-- ============================================

-- ────────────────────────────────────────────
-- 1) Make profiles.display_name + avatar publicly readable.
--    Currently only the owner can read their own profile, which means
--    buyers on the Market never see seller names.
-- ────────────────────────────────────────────
drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Profiles are publicly readable" on profiles;

create policy "Profiles are publicly readable"
  on profiles for select using (true);

-- ────────────────────────────────────────────
-- 2) Allow PostgREST to embed profiles when querying ideas.
--    ideas.user_id originally references auth.users, so PostgREST
--    can't infer an `ideas → profiles` join. We add a parallel FK
--    to profiles.id (which itself references auth.users.id), so
--    `select("*, profiles(...)")` works.
-- ────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ideas_user_id_profiles_fkey'
  ) then
    alter table ideas
      add constraint ideas_user_id_profiles_fkey
      foreign key (user_id) references profiles(id) on delete cascade;
  end if;
end $$;

-- ────────────────────────────────────────────
-- 3) Security-definer function for incrementing buy_count.
--    RLS on ideas only allows the owner to UPDATE, so a buyer can't
--    bump buy_count directly. This function bypasses RLS safely
--    (it can only ever increment by 1 on a single row).
-- ────────────────────────────────────────────
create or replace function increment_buy_count(p_idea_id uuid)
returns void as $$
begin
  update public.ideas
     set buy_count = coalesce(buy_count, 0) + 1
   where id = p_idea_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function increment_buy_count(uuid) to anon, authenticated;

-- ────────────────────────────────────────────
-- 4) Tighten purchase insert policy: seller_id must match the
--    actual idea owner so a malicious client can't fake who got paid.
-- ────────────────────────────────────────────
drop policy if exists "Users can insert purchases" on purchases;
create policy "Users can insert purchases"
  on purchases for insert with check (
    auth.uid() = buyer_id
    and seller_id = (select user_id from ideas where id = idea_id)
  );

-- ────────────────────────────────────────────
-- 5) Drop dead schema from the removed balance feature.
-- ────────────────────────────────────────────
drop table if exists transactions cascade;
alter table profiles drop column if exists balance;
