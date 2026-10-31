-- ============================================
-- Markedia Ideas Lab schema update
-- Run AFTER supabase-fix.sql.
-- Safe to re-run.
-- ============================================

-- 1) Expand the allowed statuses
--    Old: ('published', 'draft')
--    New: ('draft', 'unpublished', 'published', 'archived')
alter table ideas drop constraint if exists ideas_status_check;
alter table ideas add constraint ideas_status_check
  check (status in ('draft', 'unpublished', 'published', 'archived'));

-- 2) Snapshot of fields used at the last AI evaluation, for dirty-detection.
--    The Re-evaluate button is shown only when current heading/categories/
--    form_data differ from this snapshot.
alter table ideas add column if not exists evaluated_snapshot jsonb;

-- 3) Track when a row was archived (used for archive sort order)
alter table ideas add column if not exists archived_at timestamptz;

-- 4) Allow users to delete their own ideas
drop policy if exists "Users can delete own ideas" on ideas;
create policy "Users can delete own ideas"
  on ideas for delete using (auth.uid() = user_id);

-- 5) Buyers keep READ access to ideas they purchased — even after the
--    seller unpublishes or archives them. Without this, the Purchased
--    tab silently drops anything the seller hides.
drop policy if exists "Buyers can read purchased ideas" on ideas;
create policy "Buyers can read purchased ideas"
  on ideas for select using (
    exists (
      select 1 from purchases
      where purchases.idea_id = ideas.id
      and purchases.buyer_id = auth.uid()
    )
  );

-- 6) Helpful indexes
create index if not exists ideas_archived_at_idx on ideas(archived_at desc);
