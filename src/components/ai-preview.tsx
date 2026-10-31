import { PREVIEW_LABELS, type PreviewParts } from "@/lib/preview";

const SparkleIcon = () => (
  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
    />
  </svg>
);

/** One labelled line inside the preview block. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <span className="shrink-0 sm:w-[104px] text-[11px] font-bold uppercase tracking-[0.05em] text-accent-700/70 pt-0.5">
        {label}
      </span>
      <div className="text-[14px] leading-relaxed text-accent-900 min-w-0">{children}</div>
    </div>
  );
}

/**
 * The public AI preview block. Renders the structured five-field version when
 * the idea has one, and falls back to the plain text blob for ideas evaluated
 * before the change.
 */
export default function AiPreview({
  parts,
  text,
  heading,
  footnote,
  className = "",
}: {
  parts?: PreviewParts | null;
  /** Legacy prose preview, used when `parts` is absent. */
  text?: string | null;
  /** AI-generated public heading, titling the block. */
  heading?: string | null;
  footnote?: string;
  className?: string;
}) {
  if (!parts && !text) return null;

  return (
    <div className={`ai-preview ${className}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <SparkleIcon />
        <span className="kicker">AI Preview</span>
      </div>

      {heading && (
        <p className="text-[17px] font-heading font-semibold text-ink leading-snug mb-2">
          {heading}
        </p>
      )}

      {parts ? (
        <div className="space-y-3">
          {parts.summary && (
            <p className="text-[15px] leading-relaxed text-accent-900">{parts.summary}</p>
          )}

          {(parts.strengths || parts.considerations.length > 0 || parts.requirements || parts.market) && (
            <div className="space-y-2.5 pt-3 border-t border-accent-200/60">
              {parts.strengths && (
                <Row label={PREVIEW_LABELS.strengths}>{parts.strengths}</Row>
              )}

              {parts.considerations.length > 0 && (
                <Row label={PREVIEW_LABELS.considerations}>
                  <ul className="space-y-1">
                    {parts.considerations.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden className="text-accent-700/50 shrink-0">
                          ·
                        </span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </Row>
              )}

              {parts.requirements && (
                <Row label={PREVIEW_LABELS.requirements}>{parts.requirements}</Row>
              )}

              {parts.market && <Row label={PREVIEW_LABELS.market}>{parts.market}</Row>}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed text-accent-900 whitespace-pre-wrap">{text}</p>
      )}

      {footnote && <p className="text-[11px] text-accent-700/70 italic mt-3">{footnote}</p>}
    </div>
  );
}
