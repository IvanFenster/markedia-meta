-- ============================================
-- Markedia — Purchases and exclusivity become server-only
-- Run BEFORE deploying the matching application code. Safe to re-run.
--
-- WHY THIS EXISTS
-- The browser inserted its own purchase row and supplied `price_paid` itself:
--
--     supabase.from("purchases").insert({ buyer_id, idea_id, seller_id, price_paid })
--
-- The policy checked buyer_id and seller_id but never checked price_paid
-- against the listing, so a signed-in user could post price_paid = 0 straight
-- to the REST API and receive permanent access. Exclusivity had the same shape:
-- purchase_exclusivity() granted it to anyone who owned the idea, recording a
-- price nobody had paid.
--
-- Both now happen only in /api/purchase and /api/secure-idea, which run under
-- the service role, read the price from the database, and are where payment
-- verification will be enforced. The client keeps no way to grant itself either.
-- ============================================

-- Purchases: readable by the two parties, writable by nobody from the browser.
drop policy if exists "Users can insert purchases" on purchases;

-- Exclusivity: the RPC was callable directly by any signed-in user.
revoke execute on function purchase_exclusivity(uuid) from authenticated, anon;

-- Guard the ledger itself: a purchase must record the price actually listed.
-- The service role bypasses RLS, so this is a constraint rather than a policy —
-- it holds no matter who writes the row.
create or replace function purchases_price_matches_listing()
returns trigger language plpgsql as $$
declare
  listed integer;
begin
  select price into listed from ideas where id = new.idea_id;
  if listed is null then
    raise exception 'Idea % has no listed price and cannot be purchased', new.idea_id;
  end if;
  if new.price_paid is distinct from listed then
    raise exception 'price_paid (%) does not match the listed price (%)', new.price_paid, listed;
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_check_price on purchases;
create trigger purchases_check_price
  before insert on purchases
  for each row execute function purchases_price_matches_listing();
