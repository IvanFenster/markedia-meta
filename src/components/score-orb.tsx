import { formatScore, scoreOrbClass, scoreTone } from "@/lib/score-utils";

/**
 * The signature element: a circle, not a solid blob — tinted background, 2px
 * inset ring in the same hue, figure in the deep tone. Optionally stacked with
 * its uppercase micro-label.
 */
export default function ScoreOrb({
  score,
  size,
  label = "Score",
  showLabel = true,
  className = "",
}: {
  /** Overall score on the 0-100 scale. Null renders the "not evaluated" state. */
  score: number | null | undefined;
  size?: "sm" | "lg";
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const tone = scoreTone(score);
  const orb = (
    <div className={scoreOrbClass(tone, size)}>
      {score == null ? "–" : formatScore(score)}
    </div>
  );

  if (!showLabel) return <div className={className}>{orb}</div>;

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      {orb}
      <span className="score-label">{label}</span>
    </div>
  );
}
