-- ============================================
-- Markedia — Admin allowlist
-- Run AFTER supabase-setup.sql. Safe to re-run.
--
-- This table is deliberately LOCKED DOWN: RLS is enabled but NO policies are
-- created, so it is unreadable and unwritable through the anon / authenticated
-- API keys. Only the service-role key (used server-side by /api/admin/*) and
-- the Supabase dashboard can read or modify it. That keeps the admin list
-- secret and tamper-proof from the browser.
-- ============================================

create table if not exists admins (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table admins enable row level security;
-- (intentionally no policies — clients get zero access)

-- Seed the first admin.
insert into admins (email) values ('ivanfenster82@gmail.com')
  on conflict (email) do nothing;

-- To add another admin later, run in the SQL editor:
--   insert into admins (email) values ('someone@example.com') on conflict do nothing;
-- To remove one:
--   delete from admins where email = 'someone@example.com';
