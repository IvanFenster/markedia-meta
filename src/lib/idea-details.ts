import { supabase } from "./supabase";
import type { EvaluatedSnapshot } from "./idea-helpers";

/**
 * The paid half of an idea.
 *
 * `ideas` rows are publicly readable so the Market can list them, and RLS is
 * row-level — a policy that exposes a row exposes all of its columns. So the
 * content a buyer is actually paying for lives in `idea_details`, whose
 * policies admit only the author and confirmed buyers.
 *
 * These helpers fetch it separately and merge it back onto the idea object, so
 * components can keep reading `idea.form_data` as before.
 */
export interface IdeaDetails {
  form_data: Record<string, unknown> | null;
  reasonings: Record<string, string> | null;
  evaluated_snapshot: EvaluatedSnapshot | null;
}

const EMPTY: IdeaDetails = { form_data: {}, reasonings: null, evaluated_snapshot: null };

/**
 * Load one idea's paid content. Returns empty rather than throwing when the
 * caller isn't entitled to it — RLS simply returns no row, which is not an
 * error condition.
 */
export async function loadIdeaDetails(ideaId: string): Promise<IdeaDetails> {
  const { data, error } = await supabase
    .from("idea_details")
    .select("form_data, reasonings, evaluated_snapshot")
    .eq("idea_id", ideaId)
    .maybeSingle();
  if (error) console.error("[idea-details] load failed:", error);
  return (data as IdeaDetails | null) ?? { ...EMPTY };
}

/** Load several at once, keyed by idea id. Used by list views. */
export async function loadIdeaDetailsMany(
  ideaIds: string[]
): Promise<Map<string, IdeaDetails>> {
  const out = new Map<string, IdeaDetails>();
  if (ideaIds.length === 0) return out;
  const { data, error } = await supabase
    .from("idea_details")
    .select("idea_id, form_data, reasonings, evaluated_snapshot")
    .in("idea_id", ideaIds);
  if (error) {
    console.error("[idea-details] bulk load failed:", error);
    return out;
  }
  for (const row of data ?? []) {
    const { idea_id, ...rest } = row as IdeaDetails & { idea_id: string };
    out.set(idea_id, rest);
  }
  return out;
}

/** Create or replace an idea's paid content. Only the author may do this. */
export async function saveIdeaDetails(
  ideaId: string,
  details: Partial<IdeaDetails>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("idea_details").upsert(
    {
      idea_id: ideaId,
      form_data: details.form_data ?? {},
      reasonings: details.reasonings ?? null,
      evaluated_snapshot: details.evaluated_snapshot ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "idea_id" }
  );
  return { error: error?.message ?? null };
}
