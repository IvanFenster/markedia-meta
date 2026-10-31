-- ============================================
-- Markedia — Structured AI preview
-- Run AFTER supabase-update.sql. Safe to re-run.
--
-- The public preview used to be one prose blob in ideas.ai_preview. It is now
-- five short labelled fields — summary, strengths, considerations[],
-- requirements, market — so buyers can scan the decision, and so only the
-- summary carries any risk of revealing the idea.
--
-- ai_preview is KEPT and still written (a flattened, readable version of the
-- same content), so ideas evaluated before this change keep rendering and any
-- consumer that only reads text still gets the whole picture.
-- ============================================

alter table ideas add column if not exists ai_preview_parts jsonb;

comment on column ideas.ai_preview_parts is
  'Structured public preview: { summary, strengths, considerations[], requirements, market }. Null for ideas evaluated before the structured preview; those fall back to ai_preview.';
