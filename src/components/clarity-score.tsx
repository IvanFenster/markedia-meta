import {
  CLARITY_MAX,
  clarityExplanation,
  clarityLabel,
  clarityTone,
} from "@/lib/clarity";
import { scoreToneColor } from "@/lib/score-utils";

/**
 * Clarity of the idea — deliberately styled unlike the weighted criteria.
 *
 * The seven scored criteria use orbs and meters on a 1-10 scale; clarity uses
 * five pips on a 1-5 scale, sits in its own bordered card, and states outright
 * that it is excluded from the overall score. The visual difference is the
 * point: it is a different kind of measurement.
 */
export default function ClarityScore({
  score,
  className = "",
}: {
  score: number | null;
  className?: string;
}) {
  if (score == null) return null;

  const tone = clarityTone(score);
  const color = scoreToneColor(tone);

  return (
    <section
      className={`rounded-[18px] border border-dashed border-neutral-300 bg-neutral-100/70 p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.055em] text-neutral-600">
            Clarity of the idea
          </p>
          <p className="text-[15px] font-semibold mt-0.5" style={{ color }}>
            {clarityLabel(score)}
          </p>
        </div>

        {/* Pips rather than an orb — a different scale, shown differently. */}
        <div className="flex items-center gap-1.5 shrink-0 pt-1" aria-hidden>
          {Array.from({ length: CLARITY_MAX }, (_, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: i < score ? color : "transparent",
                boxShadow: i < score ? "none" : "inset 0 0 0 1.5px var(--color-neutral-300)",
              }}
            />
          ))}
          <span className="ml-1.5 text-[13px] font-bold num" style={{ color }}>
            {score}
            <span className="text-neutral-500 font-semibold">/{CLARITY_MAX}</span>
          </span>
        </div>
      </div>

      <p className="sr-only">
        Clarity {score} out of {CLARITY_MAX}
      </p>

      <p className="text-[13px] text-neutral-700 leading-relaxed">
        {clarityExplanation(score)}
      </p>

      <p className="text-[11.5px] text-neutral-500 italic mt-2 pt-2 border-t border-neutral-300/70">
        Rates how clearly the idea is written, not how good it is — it does not affect the overall
        score.
      </p>
    </section>
  );
}
