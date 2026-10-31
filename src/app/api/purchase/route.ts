import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records a purchase.
 *
 * This runs server-side under the service role because the browser must never
 * be able to grant itself access: it previously inserted its own `purchases`
 * row and supplied the price, so anyone could post price_paid = 0 and unlock an
 * idea for free. Every fact that matters — the price, who owns the idea, its
 * status — is read from the database here, never taken from the request.
 *
 * ── WHERE PAYMENT GOES ──────────────────────────────────────────────────────
 * There is no payment provider yet, so a validated request is granted straight
 * away, which is the behaviour the app has today ("no payment required for
 * now"). When payments land, this route splits in two: it should create a
 * payment intent and return it, and the purchase row should be written by the
 * provider's webhook after the charge is confirmed — never here, and never
 * before the money has actually moved. The validation below stays as-is.
 * ────────────────────────────────────────────────────────────────────────────
 */
export async function POST(request: Request) {
  const caller = await requireUser(request);
  if (!caller.ok) return Response.json({ error: caller.error }, { status: caller.status });

  let ideaId = "";
  try {
    ideaId = String(((await request.json()) as { ideaId?: string }).ideaId ?? "");
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!ideaId) return Response.json({ error: "Which idea?" }, { status: 400 });

  const db = supabaseAdmin!;
  const { data: idea, error: ideaErr } = await db
    .from("ideas")
    .select("id, user_id, price, status, is_exclusive, scam_flagged")
    .eq("id", ideaId)
    .maybeSingle();

  if (ideaErr) {
    console.error("[purchase] idea lookup failed:", ideaErr);
    return Response.json({ error: "Couldn't load that idea." }, { status: 500 });
  }
  if (!idea) return Response.json({ error: "That idea no longer exists." }, { status: 404 });

  // Every one of these is checked here rather than in the browser, because the
  // browser is the thing we don't trust.
  if (idea.user_id === caller.userId) {
    return Response.json({ error: "You can't buy your own idea." }, { status: 400 });
  }
  if (idea.status !== "published") {
    return Response.json({ error: "That idea isn't for sale." }, { status: 409 });
  }
  if (idea.is_exclusive) {
    return Response.json({ error: "That idea was secured by a buyer and is off the market." }, { status: 409 });
  }
  if (idea.scam_flagged) {
    return Response.json({ error: "That idea is under review and can't be bought." }, { status: 409 });
  }
  if (typeof idea.price !== "number" || idea.price < 0) {
    return Response.json({ error: "That idea has no valid price." }, { status: 409 });
  }

  const { data: existing } = await db
    .from("purchases")
    .select("id")
    .eq("buyer_id", caller.userId)
    .eq("idea_id", ideaId)
    .maybeSingle();
  if (existing) return Response.json({ ok: true, alreadyOwned: true });

  // TODO(payments): require a confirmed charge before this line.
  const { error: insertErr } = await db.from("purchases").insert({
    buyer_id: caller.userId,
    idea_id: idea.id,
    seller_id: idea.user_id,
    price_paid: idea.price, // from the database, never from the client
  });

  if (insertErr) {
    // The unique(buyer_id, idea_id) index makes a double-submit harmless.
    if (/duplicate|unique/i.test(insertErr.message)) {
      return Response.json({ ok: true, alreadyOwned: true });
    }
    console.error("[purchase] insert failed:", insertErr);
    return Response.json({ error: "Couldn't complete the purchase." }, { status: 500 });
  }

  return Response.json({ ok: true, pricePaid: idea.price });
}
