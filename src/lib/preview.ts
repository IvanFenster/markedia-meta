/**
 * The public AI preview — the only thing shown on the open market.
 *
 * It is five short labelled fields rather than one paragraph, so a buyer can
 * scan the decision without reading prose, and so only `summary` ever carries
 * leak risk. Ideas evaluated before this change have a plain text preview
 * instead; every reader falls back to that.
 */
export interface PreviewParts {
  /** The only descriptive field: space, form factor, broad situation. */
  summary: string;
  /** One sentence on what is most promising. */
  strengths: string;
  /** One short clause per criterion scoring under 6/10. Empty when none do. */
  considerations: string[];
  /** What building it asks of someone: skills, capital, time. */
  requirements: string;
  /** Competitive weather: crowded, contested, or open. */
  market: string;
}

export const PREVIEW_LABELS: Record<
  Exclude<keyof PreviewParts, "summary">,
  string
> = {
  strengths: "Strengths",
  considerations: "Considerations",
  requirements: "Requirements",
  market: "Market",
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Read the model's `preview` field. Accepts the structured object, and also a
 * bare string in case the model regresses to the old shape — that becomes the
 * summary so a run is never wasted.
 */
export function parsePreviewParts(raw: unknown): PreviewParts | null {
  if (typeof raw === "string") {
    const summary = raw.trim();
    return summary
      ? { summary, strengths: "", considerations: [], requirements: "", market: "" }
      : null;
  }
  if (!raw || typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;
  const considerations = Array.isArray(o.considerations)
    ? o.considerations.map(str).filter(Boolean).slice(0, 3)
    : [];

  const parts: PreviewParts = {
    summary: str(o.summary),
    strengths: str(o.strengths),
    considerations,
    requirements: str(o.requirements),
    market: str(o.market),
  };
  // A preview with nothing in it is a failed step, not an empty preview.
  return parts.summary || parts.strengths || parts.market ? parts : null;
}

/**
 * Readable prose for the legacy `ai_preview` text column, so anything reading
 * plain text still gets the whole picture.
 */
export function flattenPreview(p: PreviewParts): string {
  const lines: string[] = [];
  if (p.summary) lines.push(p.summary);
  if (p.strengths) lines.push(`${PREVIEW_LABELS.strengths}: ${p.strengths}`);
  if (p.considerations.length)
    lines.push(`${PREVIEW_LABELS.considerations}: ${p.considerations.join("; ")}`);
  if (p.requirements) lines.push(`${PREVIEW_LABELS.requirements}: ${p.requirements}`);
  if (p.market) lines.push(`${PREVIEW_LABELS.market}: ${p.market}`);
  return lines.join("\n");
}

/** Coerce whatever a row holds into structured parts, if it has any. */
export function readPreviewParts(value: unknown): PreviewParts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return parsePreviewParts(value);
}

/** The short description used on cards, where only one clamped line fits. */
export function previewSummary(
  parts: PreviewParts | null | undefined,
  fallback: string | null | undefined
): string {
  return parts?.summary || (fallback ?? "");
}
