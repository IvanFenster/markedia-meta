"use client";

import { STATUS_BADGE_CLASS, STATUS_LABEL, type DbIdea } from "@/lib/idea-helpers";
import InfoDot from "@/components/info-dot";
import { EXCLUSIVITY_FULL } from "@/lib/exclusivity";

/**
 * Read-only description panel for an idea — heading, status, categories, and
 * the Q&A from form_data. Used in the Lab detail view (left column).
 */
export default function IdeaDescriptionPanel({ idea }: { idea: DbIdea }) {
  const formData = idea.form_data || {};
  // The seller's own (original) heading titles this panel; the AI-generated
  // public heading lives in the AI Preview section instead.
  const originalHeading = String(formData.originalHeading || idea.heading);
  const fields: { label: string; value: string }[] = [];

  if (idea.idea_type === "research") {
    if (formData.question) fields.push({ label: "Research Question", value: String(formData.question) });
    if (formData.methodology) fields.push({ label: "Methodology", value: String(formData.methodology) });
    if (formData.equipment) fields.push({ label: "Equipment Needed", value: String(formData.equipment) });
    if (formData.time) fields.push({ label: "Estimated Time", value: String(formData.time) });
    if (formData.skills) fields.push({ label: "Skills Needed", value: String(formData.skills) });
    if (formData.otherDiscipline) fields.push({ label: "Other discipline", value: String(formData.otherDiscipline) });
    if (Array.isArray(formData.levels) && (formData.levels as string[]).length)
      fields.push({ label: "Academic level", value: (formData.levels as string[]).join(", ") });
    if (Array.isArray(formData.curriculum) && (formData.curriculum as string[]).length)
      fields.push({ label: "Curriculum", value: (formData.curriculum as string[]).join(", ") });
  } else {
    if (formData.problem) fields.push({ label: "Problem", value: String(formData.problem) });
    if (formData.solution) fields.push({ label: "Solution", value: String(formData.solution) });
    if (formData.audience) fields.push({ label: "Target Audience", value: String(formData.audience) });
    if (formData.differentiator) fields.push({ label: "Differentiator", value: String(formData.differentiator) });
    if (formData.skills) fields.push({ label: "Skills Needed", value: String(formData.skills) });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker">{idea.idea_type}</span>
          <span className={`badge ${STATUS_BADGE_CLASS[idea.status]}`}>
            {STATUS_LABEL[idea.status]}
          </span>
        </div>
        <h1 className="text-[clamp(30px,3.4vw,40px)] text-ink">{originalHeading}</h1>
        {idea.categories && idea.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {idea.categories.map((c) => (
              <span key={c} className="tag">{c}</span>
            ))}
          </div>
        )}
      </div>

      {fields.length > 0 ? (
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.label} className="card p-6">
              <p className="kicker kicker-muted mb-2">{f.label}</p>
              <p className="text-[15px] text-neutral-800 leading-relaxed whitespace-pre-wrap">{f.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel-flat rounded-[30px] p-8 text-center">
          <p className="text-sm text-neutral-600">
            No description filled in yet — click <strong className="text-ink">Edit</strong> to add details.
          </p>
        </div>
      )}

      {idea.price != null && (
        <div className="card p-6 flex items-end justify-between gap-4">
          <div>
            <p className="kicker kicker-muted">Listed price</p>
            <p className="price text-[34px] text-ink mt-1">${idea.price}</p>
            {idea.suggested_price != null && idea.suggested_price !== idea.price && (
              <p className="text-[13px] text-neutral-600 mt-0.5 num">AI suggested: ${idea.suggested_price}</p>
            )}
            {idea.exclusivity_price != null && (
              <p className="text-[13px] text-neutral-600 mt-1 num">
                Secure price: <span className="font-bold text-ink">${idea.exclusivity_price}</span>
                <InfoDot text={EXCLUSIVITY_FULL} className="ml-1.5" />
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="kicker kicker-muted">Bought by</p>
            <p className="text-[15px] font-semibold text-neutral-800 mt-1 num">
              {idea.buy_count} {idea.buy_count === 1 ? "buyer" : "buyers"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
