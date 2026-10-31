-- ============================================
-- Markedia — Clarity of the idea (separate, unweighted signal)
-- Run AFTER supabase-update.sql. Safe to re-run.
--
-- Clarity judges only how clearly an idea is WRITTEN, never how good it is, so
-- it deliberately sits outside the weighted criteria: it is scored 1-5, carries
-- no weight, never enters overall_score, and is shown to users on its own.
--
-- It lives in its own column rather than inside the `scores` jsonb precisely so
-- it cannot be picked up by anything that iterates the weighted criteria. Note
-- that ideas evaluated long ago may still carry a legacy `clarity` key inside
-- `scores` — that was a weighted 1-20 criterion and is a different thing.
-- ============================================

alter table ideas add column if not exists clarity_score smallint
  check (clarity_score is null or clarity_score between 1 and 5);

alter table evaluations add column if not exists clarity_score smallint
  check (clarity_score is null or clarity_score between 1 and 5);

comment on column ideas.clarity_score is
  'How clearly the idea is written, 1-5. Unweighted: never contributes to overall_score. Shown separately from the seven weighted criteria.';
