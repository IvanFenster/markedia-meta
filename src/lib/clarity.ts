import type { ScoreTone } from "./score-utils";

/**
 * Clarity of the idea — a separate, unweighted signal.
 *
 * It judges only how clearly an idea is WRITTEN, never how good it is, so it
 * deliberately sits outside the seven weighted criteria and never contributes
 * to the overall score.
 *
 * The explanations below are fixed: they describe what a clarity score MEANS,
 * and never reference the idea itself. The model returns a number and nothing
 * else, so these texts are identical for every idea at a given score.
 */
export const CLARITY_MAX = 5;

export const CLARITY_LABELS: Record<number, string> = {
  1: "Very unclear",
  2: "Unclear",
  3: "Adequate",
  4: "Clear",
  5: "Exceptionally clear",
};

export const CLARITY_EXPLANATIONS: Record<number, string> = {
  1: "The write-up is very hard to follow. Key terms are left undefined and the thesis shifts as it goes, so a reader would struggle to restate in one sentence what is actually being proposed.",
  2: "The idea can be recovered, but it takes effort. Sections are ambiguous and several important assumptions are left unsaid, so a buyer would need to ask follow-up questions before feeling confident.",
  3: "Adequately clear. A careful reader gets the idea on a first pass, though some parts are thin — most of the what and why is on the page, while some of the how is still sketchy.",
  4: "Clearly written. The problem, the proposed solution and the reasoning are stated directly and in an order that is easy to follow, with terms used consistently throughout.",
  5: "Exceptionally clear. Every section does its job: the problem is crisp, the solution specific, the reasoning explained, and the writing free of filler. A stranger would grasp the whole idea in one read.",
};

/** Clamp whatever is stored into the 1-5 range, or null when unscored. */
export function readClarity(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= CLARITY_MAX ? r : null;
}

/** Verdict colour for a clarity score, reusing the shared red→amber→green scale. */
export function clarityTone(score: number | null): ScoreTone {
  if (score == null) return "none";
  if (score >= 4) return "high";
  if (score === 3) return "mid";
  return "low";
}

export function clarityLabel(score: number | null): string {
  return score == null ? "Not rated" : CLARITY_LABELS[score] ?? "";
}

export function clarityExplanation(score: number | null): string {
  return score == null ? "" : CLARITY_EXPLANATIONS[score] ?? "";
}
