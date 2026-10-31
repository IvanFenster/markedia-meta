/**
 * Shared idea types and scoring helpers.
 *
 * (Historically this module also exported a `mockIdeas` array for seeding
 *  the UI during early development. All mock entries have been removed —
 *  the platform now shows only ideas submitted by real users.)
 */

export interface IdeaScore {
  originality: number;        // 1-20
  valueProposition: number;   // 1-20
  problemSolutionFit: number; // 1-20
  feasibility: number;        // 1-20
  easeOfLaunch: number;       // 1-20
  scalability: number;        // 1-20
  defensibility: number;      // 1-20
  /**
   * Legacy criterion, scored before the criteria were revised. Never produced
   * by new evaluations, but kept so older ideas still render their full
   * breakdown. It carries no weight.
   */
  clarity?: number;
}

/** The current criteria, in the order they are presented. */
export const CRITERIA_KEYS = [
  "originality",
  "valueProposition",
  "problemSolutionFit",
  "feasibility",
  "easeOfLaunch",
  "scalability",
  "defensibility",
] as const satisfies readonly (keyof IdeaScore)[];

/** Weights for overall score calculation. Sums to 1. */
export const SCORE_WEIGHTS: Record<(typeof CRITERIA_KEYS)[number], number> = {
  originality: 0.25,
  valueProposition: 0.20,
  problemSolutionFit: 0.10,
  feasibility: 0.15,
  easeOfLaunch: 0.10,
  scalability: 0.10,
  defensibility: 0.10,
};

/** Weight as a whole percentage, or null for legacy criteria that carry none. */
export function criterionWeight(key: keyof IdeaScore): number | null {
  const w = (SCORE_WEIGHTS as Record<string, number | undefined>)[key];
  return w == null ? null : Math.round(w * 100);
}

/**
 * The criteria actually present on a score object, current ones first and any
 * legacy criterion appended — so ideas scored under the old model still show a
 * complete breakdown.
 */
export function scoredCriteria(scores: IdeaScore): (keyof IdeaScore)[] {
  const all: (keyof IdeaScore)[] = [...CRITERIA_KEYS, "clarity"];
  return all.filter((k) => typeof scores[k] === "number");
}

/** Labels for display */
export const SCORE_LABELS: Record<keyof IdeaScore, string> = {
  originality: "Originality",
  valueProposition: "Value Proposition",
  problemSolutionFit: "Problem-Solution Fit",
  feasibility: "Feasibility",
  easeOfLaunch: "Ease of Launch",
  scalability: "Scalability",
  defensibility: "Defensibility",
  clarity: "Clarity",
};

/**
 * Calculate the weighted overall score (0-100) from 1-20 sub-scores.
 * Only the criteria actually present contribute, and the result is normalised
 * by the weight that was available — so a score object missing a criterion
 * still lands on the right scale instead of being silently deflated.
 */
export function calculateOverall(scores: IdeaScore): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const key of CRITERIA_KEYS) {
    const value = scores[key];
    if (typeof value !== "number") continue;
    weighted += value * SCORE_WEIGHTS[key];
    totalWeight += SCORE_WEIGHTS[key];
  }
  if (totalWeight === 0) return 0;
  // Normalise to a full-weight 1-20 average, then ×5 for the 5-100 scale.
  return Math.round((weighted / totalWeight) * 5);
}

export interface Idea {
  id: string;
  userId?: string; // Supabase author id
  heading: string;
  author: {
    name: string;
    avatar: string;
    rating: number;
    nickname?: string;
  };
  categories: string[];
  overallScore: number;
  scores: IdeaScore;
  aiPreview: string;
  aiPreviewParts?: import("./preview").PreviewParts | null;
  price: number;
  suggestedPrice: number;
  exclusivityPrice?: number | null;
  buyCount: number;
  createdAt: string;
  trending: boolean;
}

/**
 * Category filter options shown on the Market page.
 * (Kept static so the filter bar doesn't flicker based on what happens to
 *  be published right now.)
 */
export const categories = [
  "All",
  "Startup",
  "Research",
  "EdTech",
  "HealthTech",
  "CleanTech",
  "AgriTech",
  "Cybersecurity",
  "Biomedical Engineering",
  "Environmental Science",
  "Logistics",
  "Business",
];
