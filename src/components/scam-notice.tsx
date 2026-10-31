"use client";

import Link from "next/link";
import { scamReasonDetail, scamReasonLabel } from "@/lib/scam";

const ShieldAlert = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7.5 3v5.5c0 4.5-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5-7.5-9.5V6L12 3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.5M12 15.5h.01" />
  </svg>
);

const ShieldCheck = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7.5 3v5.5c0 4.5-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5-7.5-9.5V6L12 3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

/**
 * Shown to the AUTHOR when the abuse check flagged their idea. The reasons are
 * fixed codes chosen by the evaluator, rendered through our own wording — the
 * model never writes this text.
 */
export function ScamFlaggedNotice({
  reasons,
  ideaId,
  onEdit,
  onRequestReview,
  reviewRequested,
  requesting,
  className = "",
}: {
  reasons: string[];
  ideaId?: string;
  /** Provided in the Lab, where editing happens inline. */
  onEdit?: () => void;
  onRequestReview?: () => void;
  reviewRequested?: boolean;
  requesting?: boolean;
  className?: string;
}) {
  if (reasons.length === 0) return null;

  return (
    <section
      className={`rounded-[22px] border-2 border-danger/35 bg-danger-100 p-5 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="text-danger shrink-0 mt-0.5">
          <ShieldAlert />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-heading font-semibold text-danger leading-snug">
            This idea was flagged by the abuse check
          </h3>
          <p className="text-[13.5px] text-neutral-700 leading-relaxed mt-1">
            It can&apos;t be published while it stays flagged. If you think this is a mistake, ask
            for a human review — someone from Markedia will read the idea and decide.
          </p>

          <ul className="mt-3.5 space-y-2.5">
            {reasons.map((code) => (
              <li key={code} className="bg-surface/70 rounded-[14px] px-3.5 py-2.5">
                <p className="text-[13.5px] font-semibold text-danger">{scamReasonLabel(code)}</p>
                <p className="text-[12.5px] text-neutral-700 leading-relaxed mt-0.5">
                  {scamReasonDetail(code)}
                </p>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2.5 mt-4">
            {reviewRequested ? (
              <span className="badge badge-draft">Manual review requested</span>
            ) : (
              onRequestReview && (
                <button
                  type="button"
                  onClick={onRequestReview}
                  disabled={requesting}
                  className="btn btn-secondary btn-sm"
                >
                  {requesting ? "Sending…" : "Request manual review"}
                </button>
              )
            )}

            {onEdit ? (
              <button type="button" onClick={onEdit} className="btn btn-dark btn-sm">
                Edit the idea
              </button>
            ) : (
              ideaId && (
                <Link href={`/lab/${ideaId}`} className="btn btn-dark btn-sm">
                  Edit the idea
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Shown to VIEWERS on a public listing: the abuse check ran and found nothing.
 */
export function ScamClearedNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-[18px] border border-positive/25 bg-positive-100 px-4 py-3 ${className}`}
    >
      <span className="text-positive-700 shrink-0">
        <ShieldCheck />
      </span>
      <p className="text-[13px] text-positive-700 leading-snug">
        <span className="font-semibold">Checked for abuse.</span> The AI reviewed this listing and
        found no sign that it is spam or a scam.
      </p>
    </div>
  );
}
