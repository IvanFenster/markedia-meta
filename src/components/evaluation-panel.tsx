"use client";

import {
  formatSubScore,
  meterFillClass,
  scoreOrbClass,
  scoreTone,
  subScoreTo100,
  subScoreTone,
  scoreToneColor,
} from "@/lib/score-utils";
import { formatScore } from "@/lib/score-utils";
import { SCORE_LABELS, criterionWeight, scoredCriteria, type IdeaScore } from "@/lib/mock-data";
import AiPreview from "@/components/ai-preview";
import ClarityScore from "@/components/clarity-score";
import type { PreviewParts } from "@/lib/preview";

/**
 * The AI evaluation panel: overall score orb, per-criterion rows (name, weight
 * tag, figure in its verdict colour, meter), and the AI preview block.
 */
export default function EvaluationPanel({
  overallScore,
  scores,
  reasonings,
  aiPreview,
  aiPreviewParts,
  clarityScore,
  aiHeading,
  staleNotice,
  compact,
}: {
  overallScore: number | null;
  scores: IdeaScore | null;
  reasonings: Record<string, string> | null;
  aiPreview: string | null;
  /** Structured preview fields, when the idea has them. */
  aiPreviewParts?: PreviewParts | null;
  /** Unweighted 1-5 clarity signal, shown apart from the criteria. */
  clarityScore?: number | null;
  /** AI-generated public heading — titles the preview block. */
  aiHeading?: string | null;
  /** Warn that this evaluation is outdated. */
  staleNotice?: boolean;
  compact?: boolean;
}) {
  if (!scores || overallScore == null) {
    return (
      <div className="panel-flat rounded-[30px] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-neutral-800">Not yet evaluated</p>
        <p className="text-[13px] text-neutral-600 mt-1">
          Click <span className="font-bold text-ink">Evaluate</span> to get an AI score and preview.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {staleNotice && (
        <div className="rounded-[18px] bg-amber2-100 p-3.5 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-amber2-700 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-[13px] text-amber2-700 leading-relaxed">
            This evaluation is out of date — the idea has been edited since.
            Click <strong className="font-bold">Re-evaluate</strong> to refresh.
          </p>
        </div>
      )}

      {/* Overall */}
      <div className="card p-6 flex items-center gap-5">
        <div className={scoreOrbClass(scoreTone(overallScore), "lg")}>
          {formatScore(overallScore)}
        </div>
        <div>
          <span className="kicker">Overall AI score</span>
          <p className="text-[15px] text-neutral-700 mt-1.5 leading-snug">
            Weighted across 7 criteria
          </p>
        </div>
      </div>

      {/* Criterion rows */}
      <div className="card p-6 space-y-5">
        {scoredCriteria(scores).map((key) => {
          const score = scores[key] as number;
          const tone = subScoreTone(score);
          const weight = criterionWeight(key);
          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[14.5px] font-semibold text-ink">{SCORE_LABELS[key]}</span>
                  {weight != null && (
                    <span className="text-[11px] text-neutral-500 font-medium num whitespace-nowrap">{weight}% weight</span>
                  )}
                </div>
                <span
                  className="font-heading font-bold text-[17px] num shrink-0"
                  style={{ color: scoreToneColor(tone), letterSpacing: "-0.03em" }}
                >
                  {formatSubScore(score)}
                </span>
              </div>
              <div className="meter">
                <div className={meterFillClass(tone)} style={{ width: `${subScoreTo100(score)}%` }} />
              </div>
              {!compact && reasonings?.[key] && (
                <p className="text-[13px] text-neutral-600 leading-relaxed mt-2.5">{reasonings[key]}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Clarity — separate from the weighted criteria above */}
      <ClarityScore score={clarityScore ?? null} />

      {/* AI preview */}
      <AiPreview
        parts={aiPreviewParts}
        text={aiPreview}
        heading={aiHeading}
        footnote="The public heading and this preview are what buyers see on the Market — the full idea stays hidden until purchase."
      />
    </div>
  );
}
