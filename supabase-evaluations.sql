-- ============================================
-- Markedia — Evaluations (server-side AI evaluation history)
-- Run AFTER supabase-update.sql. Safe to re-run.
--
-- One row per evaluation run (every Evaluate / Re-evaluate). Holds the
-- structured result (scores, preview, suggested price) AND the operational
-- telemetry (tokens, durations, raw per-step model I/O, cost). The `ideas`
-- table still caches the LATEST result for fast app reads; this is the history.
--
-- idea_id is a plain uuid WITHOUT a foreign key on purpose: in the "create new
-- idea" flow the evaluation is logged BEFORE the idea row exists, so a FK would
-- fail. We link by id value instead.
--
-- LOCKED DOWN: RLS enabled with NO policies, so it is unreadable/unwritable via
-- the browser keys. Only the service-role key (used by /api/evaluate to write
-- and /api/admin/* to read) and the dashboard can touch it. It contains full
-- confidential idea content.
-- ============================================

create table if not exists evaluations (
  id            uuid primary key default gen_random_uuid(),
  eval_id       text,                       -- the pipeline's internal evalId
  idea_id       uuid,                        -- links to ideas.id (no FK; see note)
  user_id       uuid,                        -- the author (metadata)
  idea_type     text,
  ok            boolean not null default false,
  error         text,
  overall_score integer,
  scores        jsonb,
  reasonings    jsonb,
  ai_preview    text,
  public_heading text,
  suggested_price integer,
  competitor_research text,
  models        jsonb,                       -- { gemini, deepseek }
  totals        jsonb,                       -- { tokens, searchQueries, ... }
  est_cost_usd  numeric,
  duration_ms   integer,
  idea_input    jsonb,                       -- the fields sent to the models
  steps         jsonb,                       -- per-step raw model I/O (heavy)
  created_at    timestamptz not null default now()
);

alter table evaluations enable row level security;
-- (intentionally no policies — clients get zero access)

create index if not exists evaluations_idea_idx on evaluations(idea_id);
create index if not exists evaluations_user_idx on evaluations(user_id);
create index if not exists evaluations_created_idx on evaluations(created_at desc);

-- ── Cleanup: drop the dead `transactions` table (removed wallet feature) ──
drop table if exists transactions cascade;
