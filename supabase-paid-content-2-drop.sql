-- ============================================
-- Markedia — Paid content, step 2 of 2: close the leak
--
-- RUN THIS ONLY AFTER the matching application code is deployed.
--
-- Until this runs, the paid content still sits on the publicly readable `ideas`
-- row and anyone with the anon key can read it. Running it before the deploy
-- would break the live site, because the old code still reads these columns.
--
-- Order:
--   1. supabase-paid-content-1-create.sql   (safe any time)
--   2. deploy the application code
--   3. this file                            (closes the leak)
-- ============================================

alter table ideas drop column if exists form_data;
alter table ideas drop column if exists reasonings;
alter table ideas drop column if exists evaluated_snapshot;
