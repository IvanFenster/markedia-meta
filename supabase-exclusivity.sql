-- ============================================
-- Markedia — Exclusivity upgrade + reliable buy_count
-- Run AFTER supabase-update.sql. Safe to re-run.
-- ============================================

-- 1) Exclusivity columns on ideas.
--    exclusivity_price: optional price a buyer can pay to take the idea off the
--    market. is_exclusive: set once someone buys it exclusively. The idea stays
--    status='published' (so the page can still say "no longer available") but is
--    filtered out of listings/search/recommendations.
alter table ideas add column if not exists exclusivity_price integer;
alter table ideas add column if not exists is_exclusive boolean not null default false;
alter table ideas add column if not exists exclusive_buyer_id uuid references auth.users(id) on delete set null;
alter table ideas add column if not exists exclusive_at timestamptz;
alter table ideas add column if not exists exclusive_price_paid integer;

create index if not exists ideas_is_exclusive_idx on ideas(is_exclusive);

-- 2) Make buy_count authoritative: recompute from purchases, then keep it in
--    sync with a trigger (SECURITY DEFINER bypasses the owner-only UPDATE RLS).
--    The client no longer increments it manually, so there's no double counting.
update ideas set buy_count = (select count(*) from purchases p where p.idea_id = ideas.id);

create or replace function bump_buy_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update ideas set buy_count = coalesce(buy_count, 0) + 1 where id = new.idea_id;
  return new;
end;
$$;

drop trigger if exists on_purchase_bump_count on purchases;
create trigger on_purchase_bump_count
  after insert on purchases
  for each row execute function bump_buy_count();

-- 3) Secure exclusivity purchase. Only a user who has already bought the idea
--    can make it exclusive, and only if the seller offered it and it isn't
--    already exclusive. Runs as definer so the buyer can flip the seller's row
--    without direct UPDATE rights.
create or replace function purchase_exclusivity(p_idea_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_idea ideas;
  v_has boolean;
begin
  select * into v_idea from ideas where id = p_idea_id;
  if not found then return jsonb_build_object('ok', false, 'message', 'Idea not found'); end if;
  if v_idea.exclusivity_price is null then
    return jsonb_build_object('ok', false, 'message', 'Exclusivity is not offered for this idea');
  end if;
  if v_idea.is_exclusive then
    return jsonb_build_object('ok', false, 'message', 'This idea is already exclusive');
  end if;
  select exists (select 1 from purchases where idea_id = p_idea_id and buyer_id = auth.uid()) into v_has;
  if not v_has then
    return jsonb_build_object('ok', false, 'message', 'You must buy the idea before you can upgrade to exclusive');
  end if;

  update ideas
    set is_exclusive = true,
        exclusive_buyer_id = auth.uid(),
        exclusive_at = now(),
        exclusive_price_paid = v_idea.exclusivity_price
  where id = p_idea_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function purchase_exclusivity(uuid) to authenticated;
