-- ============================================
-- Markedia — Author nicknames + public profiles
-- Run AFTER supabase-setup.sql. Safe to re-run.
-- ============================================

-- 1) Add a unique nickname (handle) used in profile URLs. display_name stays
--    free-form and may repeat across users; nickname must be unique.
alter table profiles add column if not exists nickname text;

-- 2) Backfill nicknames for existing profiles: slug of display_name, de-duped
--    with a numeric suffix. Only touches rows that don't have one yet.
update profiles p
set nickname = sub.nick
from (
  select id, base || case when rn = 1 then '' else rn::text end as nick
  from (
    select
      id,
      coalesce(nullif(regexp_replace(lower(coalesce(display_name, 'user')), '[^a-z0-9_]+', '', 'g'), ''), 'user') as base,
      row_number() over (
        partition by coalesce(nullif(regexp_replace(lower(coalesce(display_name, 'user')), '[^a-z0-9_]+', '', 'g'), ''), 'user')
        order by created_at
      ) as rn
    from profiles
  ) s
) sub
where p.id = sub.id and p.nickname is null;

-- 3) Case-insensitive uniqueness (partial, so rows still missing one don't block).
create unique index if not exists profiles_nickname_unique on profiles (lower(nickname)) where nickname is not null;

-- 4) Make profiles publicly readable. WITHOUT this, other users see "Unknown"
--    as the author of every idea, and public profiles can't load.
drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Profiles are publicly readable" on profiles;
create policy "Profiles are publicly readable"
  on profiles for select using (true);

-- 5) Update the signup trigger to assign a unique nickname (loops until free).
create or replace function handle_new_user()
returns trigger as $$
declare
  base text;
  nick text;
  n int := 0;
begin
  base := nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))), '[^a-z0-9_]+', '', 'g'), '');
  base := coalesce(base, 'user');
  nick := base;
  while exists (select 1 from profiles where lower(nickname) = lower(nick)) loop
    n := n + 1;
    nick := base || n::text;
  end loop;

  insert into profiles (id, display_name, avatar_initials, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 2)),
    nick
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- 6) Public profile aggregate stats. Security-definer so the counts are visible
--    to anyone, without exposing individual purchase rows (RLS stays strict).
create or replace function public_profile_stats(p_user_id uuid)
returns table (sold_count bigint, bought_count bigint)
language sql security definer set search_path = public as $$
  select
    (select count(*) from purchases where seller_id = p_user_id) as sold_count,
    (select count(*) from purchases where buyer_id = p_user_id) as bought_count;
$$;
grant execute on function public_profile_stats(uuid) to anon, authenticated;
