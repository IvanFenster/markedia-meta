/**
 * Generic, pre-written explanations for each criterion × score range.
 *
 * Scores from the DB are on a 1–20 scale (per IdeaScore). We normalise them
 * onto a 0–10 scale (the numbers shoppers see) and map into five buckets:
 *   0–2   very weak
 *   2–4   weak
 *   4–6   average
 *   6–8   strong
 *   8–10  exceptional
 *
 * IMPORTANT: These texts are *generic* — they never reference the idea's
 * content, author, or categories. They describe what a score in that range
 * *means* about any idea, so non-buyers can read them without spoiling what
 * the idea actually is.
 */

import type { IdeaScore } from "./mock-data";

export type ScoreRange = "0-2" | "2-4" | "4-6" | "6-8" | "8-10";

export const SCORE_RANGE_LABEL: Record<ScoreRange, string> = {
  "0-2": "Very weak (0–2)",
  "2-4": "Weak (2–4)",
  "4-6": "Average (4–6)",
  "6-8": "Strong (6–8)",
  "8-10": "Exceptional (8–10)",
};

/**
 * Convert a sub-score on the 1–20 scale (DB representation) to the 0–10
 * scale the rest of the UI uses, then pick the bucket.
 */
export function scoreRangeFromSubScore(subScore: number): ScoreRange {
  const tenScale = subScore / 2; // 1→0.5, 20→10
  if (tenScale < 2) return "0-2";
  if (tenScale < 4) return "2-4";
  if (tenScale < 6) return "4-6";
  if (tenScale < 8) return "6-8";
  return "8-10";
}

type ExplanationTable = Record<keyof IdeaScore, Record<ScoreRange, string>>;

export const SCORE_EXPLANATIONS: ExplanationTable = {
  originality: {
    "0-2":
      "The concept falls squarely into territory that has been explored many times before. It closely mirrors ideas already widely available, with little that would set it apart from existing solutions. A buyer looking for a distinctive angle would likely not find one here.",
    "2-4":
      "There are faint hints of a fresh perspective, but most of the core reasoning echoes approaches that are already common. It may combine familiar elements in a slightly different order, yet not enough to feel genuinely new.",
    "4-6":
      "The idea includes at least one noticeable twist on an existing approach. It isn't entirely novel, but it isn't a carbon copy either — there's something worth a second look, even if much of it is built on well-trodden ground.",
    "6-8":
      "Clear originality shows through. The idea reframes a known problem or offers a mechanism that isn't widely used, giving it a recognisable identity of its own. Competitors would need effort to replicate the key insight.",
    "8-10":
      "Highly original. The core concept introduces thinking, mechanics, or framing that is rarely or never seen in the space. If executed, it could define a new category rather than fit into an existing one.",
  },

  valueProposition: {
    "0-2":
      "The value on offer is faint. It isn't clear who would feel meaningfully better off using this, and the status quo looks comfortable enough that nobody would go out of their way to change it.",
    "2-4":
      "There is some value here, but it reads as a convenience rather than a need. Users would understand the appeal and still carry on with whatever they use today.",
    "4-6":
      "A real benefit for a recognisable group, though not an urgent one. People would use it if it appeared in front of them; few would go looking, and fewer would pay much.",
    "6-8":
      "A strong, legible benefit. The pain being removed is one the audience can name, and the improvement is large enough that paying for it is an easy argument to make.",
    "8-10":
      "Compelling value — a painkiller rather than a vitamin. The problem is acute, the relief is obvious, and willingness to pay follows naturally from how much the current situation costs people.",
  },

  easeOfLaunch: {
    "0-2":
      "A long runway stands between this idea and its first user. Heavy capital, regulatory approval, physical build-out, or a severe cold-start problem must be cleared before anything can ship at all.",
    "2-4":
      "Getting to a first version is a substantial undertaking. Significant upfront cost, licensing, or partnerships have to land before real users can touch it.",
    "4-6":
      "A launch is realistic but not quick. Expect months of work and some meaningful dependency — integrations, supply, or an initial base of users — before the product does anything useful.",
    "6-8":
      "A small team could get a usable version in front of real users fairly quickly, on modest resources. The remaining obstacles are ordinary build work rather than gatekeepers.",
    "8-10":
      "Could be launched almost immediately, by very few people, at negligible cost. Nothing external has to be secured first, so the idea can meet real users while it is still cheap to change.",
  },

  feasibility: {
    "0-2":
      "Bringing this idea to life would face severe obstacles under current technology, regulation, or economics. Key assumptions would have to be solved as prerequisites before any real progress is possible.",
    "2-4":
      "Execution is possible in principle but faces large, compounding risks. Several pieces are not yet off-the-shelf, and a team would need significant time and resources before reaching a first usable version.",
    "4-6":
      "Reasonable feasibility. Most components exist and are accessible, though integrating them will require meaningful effort. A capable team could deliver a first version, but the path is not frictionless.",
    "6-8":
      "Feasible with a focused effort. The required technology, skills, and operating conditions are clearly within reach, and the main risks are execution speed and quality rather than whether it can be done.",
    "8-10":
      "Highly feasible. Everything needed to build a first version is already available and well understood. The main work is assembly and polish, not invention — a small, capable team could move quickly.",
  },

  scalability: {
    "0-2":
      "Scaling this idea would run into hard limits quickly. Every new user or unit demands roughly the same amount of human effort or cost, and there's no clear leverage that would make growth cheaper over time.",
    "2-4":
      "Growth is possible but linear. Each increment requires nearly proportional extra resources, and the mechanisms that usually enable non-linear scale — automation, network effects, repeatable distribution — are only lightly present.",
    "4-6":
      "Moderate scalability. It can grow meaningfully, but bottlenecks will appear at certain thresholds that will need deliberate reinvestment to clear. It isn't a ceiling, but it isn't a flywheel either.",
    "6-8":
      "Strong scalability. Once the core is in place, adding new users, markets, or volume has a much smaller marginal cost than the first unit. Growth can accelerate rather than plateau.",
    "8-10":
      "Exceptionally scalable. The design has clear leverage — software-like economics, network effects, or distribution that compounds — so a much larger version is realistic without a proportional jump in cost.",
  },

  defensibility: {
    "0-2":
      "There's little to prevent a competitor from copying this once it's visible. No meaningful moat — no unique data, technology, brand, or network — stands between this idea and fast-follower clones.",
    "2-4":
      "Only a thin layer of defensibility. A determined competitor with modest resources could replicate most of what makes this valuable. First-mover advantage would be the main edge, which erodes quickly.",
    "4-6":
      "Partial defensibility. There are at least one or two elements — skill, relationships, a niche audience, or small data advantages — that slow down copycats, but a well-funded rival could still close the gap.",
    "6-8":
      "Solid defensibility. The idea contains real moats: proprietary knowledge, a hard-to-replicate process, meaningful switching costs, or an early community effect that compounds with use.",
    "8-10":
      "Strongly defensible. Multiple compounding moats — network effects, data advantage, regulatory edge, deep expertise, or ecosystem lock-in — would make it very hard for a newcomer to displace a working version of this.",
  },

  problemSolutionFit: {
    "0-2":
      "The solution doesn't clearly match the problem it claims to address. Either the problem is vaguely defined, the solution solves a different one, or both sides are too broad to really connect.",
    "2-4":
      "A loose fit. The solution addresses parts of the problem but leaves significant aspects untouched, or applies too much force to a side issue while the main pain remains.",
    "4-6":
      "Reasonable fit. The solution clearly tackles the stated problem, though some edges are rough — there are adjacent problems the approach won't cover, or a few assumptions about user behaviour that may not hold.",
    "6-8":
      "Good alignment. The solution is well-targeted to the specific problem, with the mechanism of help being clear and direct. Users in the stated situation would recognise their pain and see the value quickly.",
    "8-10":
      "Excellent problem–solution fit. The solution maps tightly to a sharply defined problem — nothing extra, nothing missing — and the path from \"person in pain\" to \"problem resolved\" is short and obvious.",
  },

  clarity: {
    "0-2":
      "The idea is hard to follow. Key terms are undefined, the core thesis shifts, and a reader would struggle to restate in a sentence what is being proposed or why it matters.",
    "2-4":
      "Rough clarity. The main idea can be recovered with effort, but some sections are ambiguous and important assumptions are left implicit. A buyer would need to ask several follow-up questions.",
    "4-6":
      "Adequately clear. A careful reader will get the idea on first pass, though a few parts could be tighter. Most of the \"what\" and \"why\" is on the page; some of the \"how\" is still sketchy.",
    "6-8":
      "Clearly written. The problem, proposed solution, and reasoning are stated directly and in an order that's easy to follow. Terms are used consistently and the overall shape of the idea is easy to summarise.",
    "8-10":
      "Exceptionally clear. Every section does its job — the problem is crisp, the solution is specific, the mechanism is explained, and the text is free of filler. A stranger could grasp the full idea in one read.",
  },
};

/** Convenience helper used by the public idea page. */
export function getScoreExplanation(
  criterion: keyof IdeaScore,
  subScore: number,
): { range: ScoreRange; rangeLabel: string; text: string } {
  const range = scoreRangeFromSubScore(subScore);
  return {
    range,
    rangeLabel: SCORE_RANGE_LABEL[range],
    text: SCORE_EXPLANATIONS[criterion][range],
  };
}
