/** Convert a 0-100 overall score to display string: "10" if perfect, else "X.X" */
export function formatScore(score: number): string {
  const val = score / 10;
  return val === 10 ? "10" : val.toFixed(1);
}

/** Format a 1-20 sub-criterion score: "10" if perfect, else "X.X" on 1.0–10.0 scale */
export function formatSubScore(score: number): string {
  const val = score / 2;
  return val === 10 ? "10" : val.toFixed(1);
}

/** Convert a 1-20 sub-score to the 0-100 scale */
export function subScoreTo100(score: number): number {
  return Math.round(((score - 1) / 19) * 100);
}

/**
 * The verdict scale — red through amber to green, deliberately muted so it
 * reads as judgement rather than emphasis (the accent orange is the only
 * hue allowed to raise its hand).
 */
export type ScoreTone = "high" | "mid" | "low" | "none";

/** Tone for a 0-100 score. Null/undefined reads as "not yet evaluated". */
export function scoreTone(score: number | null | undefined): ScoreTone {
  if (score == null) return "none";
  if (score >= 78) return "high";
  if (score >= 65) return "mid";
  return "low";
}

/** Tone for a 1-20 sub-criterion score. */
export function subScoreTone(score: number | null | undefined): ScoreTone {
  return score == null ? "none" : scoreTone(subScoreTo100(score));
}

/** Class list for the score orb, e.g. `score score-lg score-high`. */
export function scoreOrbClass(tone: ScoreTone, size?: "sm" | "lg"): string {
  return `score${size ? ` score-${size}` : ""} score-${tone}`;
}

/** Class list for a meter fill in the matching verdict colour. */
export function meterFillClass(tone: ScoreTone): string {
  if (tone === "mid") return "meter-fill meter-fill-mid";
  if (tone === "low") return "meter-fill meter-fill-low";
  return "meter-fill";
}

/**
 * Raw verdict colour, for the few places that need a value rather than a class
 * (criterion figures, inline SVG).
 */
export function scoreToneColor(tone: ScoreTone): string {
  switch (tone) {
    case "high": return "#2c5f41";
    case "mid": return "#8a600c";
    case "low": return "#a3311a";
    default: return "#ab9c8e";
  }
}
