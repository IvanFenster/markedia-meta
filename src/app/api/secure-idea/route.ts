import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Secures an idea: the buyer pays extra to take it off the market so no future
 * rival can buy it too.
 *
 * Previously a signed-in user could call the purchase_exclusivity() RPC
 * directly, which granted exclusivity to anyone who owned the idea and recorded
 * a price nobody had paid. That RPC is no longer callable from the browser.
 *
 * ── WHERE PAYMENT GOES ──────────────────────────────────────────────────────
 * As with /api/purchase: today a validated request is granted immediately.
 * Once payments exist, the flip should happen in the provider's webhook after
 * the charge clears, not here.
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
    .select("id, exclusivity_price, is_exclusive")
    .eq("id", ideaId)
    .maybeSingle();

  if (ideaErr) {
    console.error("[secure-idea] lookup failed:", ideaErr);
    return Response.json({ error: "Couldn't load that idea." }, { status: 500 });
  }
  if (!idea) return Response.json({ error: "That idea no longer exists." }, { status: 404 });
  if (idea.exclusivity_price == null) {
    return Response.json({ error: "This idea can't be secured." }, { status: 409 });
  }
  if (idea.is_exclusive) {
    return Response.json({ error: "This idea has already been secured." }, { status: 409 });
  }

  const { data: owns } = await db
    .from("purchases")
    .select("id")
    .eq("buyer_id", caller.userId)
    .eq("idea_id", ideaId)
    .maybeSingle();
  if (!owns) {
    return Response.json({ error: "Buy the idea before securing it." }, { status: 403 });
  }

  // TODO(payments): require a confirmed charge before this line.

  // Conditional on is_exclusive still being false, so two buyers racing each
  // other cannot both win — the loser's update matches zero rows.
  const { data: updated, error: updErr } = await db
    .from("ideas")
    .update({
      is_exclusive: true,
      exclusive_buyer_id: caller.userId,
      exclusive_at: new Date().toISOString(),
      exclusive_price_paid: idea.exclusivity_price,
      status: "unpublished", // a secured idea leaves the market
    })
    .eq("id", ideaId)
    .eq("is_exclusive", false)
    .select("id");

  if (updErr) {
    console.error("[secure-idea] update failed:", updErr);
    return Response.json({ error: "Couldn't secure the idea." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return Response.json({ error: "Someone secured this idea moments before you." }, { status: 409 });
  }

  return Response.json({ ok: true, pricePaid: idea.exclusivity_price });
}
