/**
 * Abuse check.
 *
 * Every evaluation also judges whether a submission is an attempt to game the
 * marketplace rather than a genuine idea. Reasons are CODES chosen from the
 * fixed list below — never model-written prose — so the author always sees
 * wording we control, and so the set stays reviewable and translatable.
 *
 * A flagged idea cannot be published (enforced in the UI and by a database
 * trigger, see supabase-scam-check.sql).
 */

export const SCAM_REASONS = {
  prompt_injection: {
    label: "Instructions aimed at the evaluator",
    detail:
      "The submission contains text written to the AI rather than to a reader — telling it how to behave, what to score, or to ignore its instructions.",
  },
  score_manipulation: {
    label: "Attempt to influence the scores",
    detail:
      "The submission argues for or demands particular scores, rather than describing the idea and letting it be judged on its merits.",
  },
  preview_manipulation: {
    label: "Attempt to dictate the public preview",
    detail:
      "The submission tries to control what the public preview says, instead of leaving it to be written from the idea.",
  },
  not_an_idea: {
    label: "No real idea submitted",
    detail:
      "The fields hold placeholder text, gibberish, or filler rather than an actual problem and solution.",
  },
  advertising: {
    label: "Advertising rather than an idea",
    detail:
      "The submission promotes an existing product, service, or link instead of offering an idea for someone else to build.",
  },
  off_platform_contact: {
    label: "Pushes buyers off Markedia",
    detail:
      "The submission asks buyers to make contact or pay somewhere else, which puts them outside every protection the marketplace offers.",
  },
  harmful_or_illegal: {
    label: "Harmful or illegal proposal",
    detail:
      "The idea describes something illegal, or something whose main purpose is to cause harm.",
  },
} as const;

export type ScamReasonCode = keyof typeof SCAM_REASONS;

export const SCAM_REASON_CODES = Object.keys(SCAM_REASONS) as ScamReasonCode[];

/** Keep only codes we actually defined — the model can only choose, never invent. */
export function parseScamReasons(raw: unknown): ScamReasonCode[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<ScamReasonCode>();
  for (const item of raw) {
    const code = String(item ?? "").trim().toLowerCase();
    if ((SCAM_REASON_CODES as string[]).includes(code)) seen.add(code as ScamReasonCode);
  }
  return [...seen];
}

export function scamReasonLabel(code: string): string {
  return SCAM_REASONS[code as ScamReasonCode]?.label ?? code;
}

export function scamReasonDetail(code: string): string {
  return SCAM_REASONS[code as ScamReasonCode]?.detail ?? "";
}

/**
 * A flag only counts when the evaluator also named a reason we recognise —
 * otherwise a stray `true` would block an author with no explanation.
 */
export function isScamFlagged(flagged: unknown, reasons: ScamReasonCode[]): boolean {
  return flagged === true && reasons.length > 0;
}
