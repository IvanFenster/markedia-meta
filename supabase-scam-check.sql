-- ============================================
-- Markedia — Abuse / scam check
-- Run AFTER supabase-update.sql. Safe to re-run.
--
-- Every evaluation now also judges whether the submission is an abuse attempt:
-- prompt injection aimed at the evaluator, an attempt to inflate its own scores
-- or dictate its public preview, placeholder junk, advertising, pushing buyers
-- off-platform, or illegal content.
--
-- Reasons are CODES chosen from a fixed list (see src/lib/scam.ts), never free
-- text, so the author is shown wording we control rather than model prose.
-- A flagged idea cannot be published.
-- ============================================

alter table ideas add column if not exists scam_flagged boolean not null default false;
alter table ideas add column if not exists scam_reasons text[] not null default '{}';
alter table ideas add column if not exists scam_review_requested boolean not null default false;
alter table ideas add column if not exists scam_review_requested_at timestamptz;

alter table evaluations add column if not exists scam_flagged boolean;
alter table evaluations add column if not exists scam_reasons text[];

create index if not exists ideas_scam_flagged_idx on ideas(scam_flagged) where scam_flagged;

comment on column ideas.scam_reasons is
  'Fixed reason codes chosen by the evaluator, never generated text. See SCAM_REASONS in src/lib/scam.ts.';

-- Belt and braces: a flagged idea must never reach the market, even if a client
-- tries to set status directly. RLS already limits updates to the owner; this
-- makes the rule structural rather than a UI convention.
create or replace function block_publishing_flagged_ideas()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.scam_flagged then
    raise exception 'This idea is flagged by the abuse check and cannot be published.';
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_block_flagged_publish on ideas;
create trigger ideas_block_flagged_publish
  before insert or update on ideas
  for each row execute function block_publishing_flagged_ideas();
