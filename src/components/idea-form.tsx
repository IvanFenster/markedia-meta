"use client";

import { useState } from "react";
import {
  startupCategoriesPrimary,
  startupCategoriesExtra,
  researchDisciplines,
  academicLevels,
  curriculumOptions,
  timeEstimates,
} from "@/lib/idea-helpers";

// ─── Form data shape (loose JSON to match DB form_data column) ───
export interface IdeaFormState {
  type: "startup" | "research";
  heading: string;
  categories: string[];
  // startup-specific
  problem?: string;
  solution?: string;
  audience?: string;
  differentiator?: string;
  skills?: string;
  // research-specific
  question?: string;
  methodology?: string;
  equipment?: string;
  time?: string;
  otherDiscipline?: string;
  levels?: string[];
  curriculum?: string[];
}

export function emptyForm(type: "startup" | "research" = "startup"): IdeaFormState {
  return {
    type,
    heading: "",
    categories: [],
    problem: "",
    solution: "",
    audience: "",
    differentiator: "",
    skills: "",
    question: "",
    methodology: "",
    equipment: "",
    time: "",
    otherDiscipline: "",
    levels: [],
    curriculum: [],
  };
}

/** Pull a state object out of a DB idea row, for editing. */
export function formStateFromDb(
  idea_type: string,
  heading: string,
  categories: string[] | null,
  form_data: Record<string, unknown> | null
): IdeaFormState {
  const fd = form_data || {};
  const type = idea_type === "research" ? "research" : "startup";
  // The public `heading` column holds the AI-generated heading once evaluated.
  // The seller's own typed heading lives in form_data.originalHeading (the
  // hidden idea blob). Prefer it when editing; fall back to the column for
  // legacy rows that predate the AI-heading split.
  return {
    type,
    heading: String(fd.originalHeading || heading || ""),
    categories: categories || [],
    problem: String(fd.problem || ""),
    solution: String(fd.solution || ""),
    audience: String(fd.audience || ""),
    differentiator: String(fd.differentiator || ""),
    skills: String(fd.skills || ""),
    question: String(fd.question || ""),
    methodology: String(fd.methodology || ""),
    equipment: String(fd.equipment || ""),
    time: String(fd.time || ""),
    otherDiscipline: String(fd.otherDiscipline || ""),
    levels: Array.isArray(fd.levels) ? (fd.levels as string[]) : [],
    curriculum: Array.isArray(fd.curriculum) ? (fd.curriculum as string[]) : [],
  };
}

/** Build the JSONB blob we store in form_data. */
export function buildFormData(s: IdeaFormState): Record<string, unknown> {
  // `originalHeading` preserves the seller's own typed heading as part of the
  // hidden idea (the public `heading` column gets the AI-generated heading).
  if (s.type === "startup") {
    return {
      originalHeading: s.heading || "",
      problem: s.problem || "",
      solution: s.solution || "",
      audience: s.audience || "",
      differentiator: s.differentiator || "",
      skills: s.skills || "",
    };
  }
  return {
    originalHeading: s.heading || "",
    question: s.question || "",
    methodology: s.methodology || "",
    equipment: s.equipment || "",
    time: s.time || "",
    skills: s.skills || "",
    otherDiscipline: s.otherDiscipline || "",
    levels: s.levels || [],
    curriculum: s.curriculum || [],
  };
}

/** Validation: returns the set of error field keys. Empty set = ok. */
export function validateForm(s: IdeaFormState): Set<string> {
  const errs = new Set<string>();
  if (!s.heading.trim()) errs.add("heading");
  if (s.type === "startup") {
    if (!s.problem?.trim()) errs.add("problem");
    if (!s.solution?.trim()) errs.add("solution");
  } else {
    if (!s.question?.trim()) errs.add("question");
    if (!s.methodology?.trim()) errs.add("methodology");
  }
  return errs;
}

// ─── Pill row controls ───
/**
 * Multi-select pill group that wraps to multiple rows.
 *
 * When `extra` is provided, the extra options are hidden behind a
 * "Show more" toggle. Selected extras are always visible (even when
 * collapsed) so the user can see what they've picked.
 */
function MultiSelect({
  options,
  extra,
  selected,
  onChange,
}: {
  options: string[];
  extra?: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [showExtra, setShowExtra] = useState(false);
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt]
    );
  };

  // When collapsed, still surface any extras the user has already picked
  // so nothing disappears on them.
  const visibleExtras = extra
    ? (showExtra ? extra : extra.filter((o) => selected.includes(o)))
    : [];
  const hiddenCount = extra ? extra.length - visibleExtras.length : 0;

  const Pill = ({ opt }: { opt: string }) => (
    <button
      type="button"
      onClick={() => toggle(opt)}
      className={`chip btn-sm ${selected.includes(opt) ? "chip-active" : ""}`}
    >
      {opt}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Pill key={opt} opt={opt} />
      ))}
      {visibleExtras.map((opt) => (
        <Pill key={opt} opt={opt} />
      ))}
      {extra && (
        <button
          type="button"
          onClick={() => setShowExtra(!showExtra)}
          className="chip chip-dashed btn-sm text-accent-700"
        >
          {showExtra ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

function SingleSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`chip btn-sm ${selected === opt ? "chip-active" : ""}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  required,
  placeholder,
  value,
  onChange,
  multiline,
  error,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  error?: boolean;
}) {
  const Component = multiline ? "textarea" : "input";
  return (
    <div>
      <label className={`field-label ${error ? "text-danger" : ""}`}>
        {label} {required && <span className="field-req">*</span>}
      </label>
      <Component
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 4 : undefined}
        className={`input ${error ? "input-error" : ""}`}
      />
    </div>
  );
}

// ─── Main reusable form ───
export default function IdeaForm({
  state,
  onChange,
  errorFields,
}: {
  state: IdeaFormState;
  onChange: (s: IdeaFormState) => void;
  errorFields?: Set<string>;
}) {
  const set = <K extends keyof IdeaFormState>(k: K, v: IdeaFormState[K]) =>
    onChange({ ...state, [k]: v });
  const errs = errorFields || new Set<string>();

  return (
    <div className="space-y-6">
      {/* Startup is the only idea type you can create. Research ideas predate
          that change, so their fields still render when editing an old one. */}
      {state.type === "startup" ? (
        <>
          <Field
            label="Heading"
            required
            placeholder='e.g., "AI-powered platform for matching freelancers with micro-tasks"'
            value={state.heading}
            onChange={(v) => set("heading", v)}
            error={errs.has("heading")}
          />

          <div>
            <label className="field-label">Categories</label>
            <MultiSelect
              options={startupCategoriesPrimary}
              extra={startupCategoriesExtra}
              selected={state.categories}
              onChange={(v) => set("categories", v)}
            />
          </div>

          <Field
            label="What problem does your idea solve?"
            required
            placeholder="Describe the pain point or gap in the market..."
            value={state.problem || ""}
            onChange={(v) => set("problem", v)}
            multiline
            error={errs.has("problem")}
          />

          <Field
            label="How exactly does your idea solve the problem?"
            required
            placeholder="Explain your approach, mechanism, or product concept..."
            value={state.solution || ""}
            onChange={(v) => set("solution", v)}
            multiline
            error={errs.has("solution")}
          />

          <Field
            label="Who is the target audience or who would benefit from this?"
            placeholder="e.g., Small business owners, college students, healthcare providers..."
            value={state.audience || ""}
            onChange={(v) => set("audience", v)}
            multiline
          />

          <Field
            label="What makes this idea different from existing solutions?"
            placeholder="Describe your unique angle or competitive advantage..."
            value={state.differentiator || ""}
            onChange={(v) => set("differentiator", v)}
            multiline
          />

          <Field
            label="What skills or expertise would a buyer need to execute this?"
            placeholder="e.g., Full-stack development, marketing experience, domain knowledge..."
            value={state.skills || ""}
            onChange={(v) => set("skills", v)}
            multiline
          />
        </>
      ) : (
        <>
          <Field
            label="Heading"
            required
            placeholder='e.g., "The effect of microplastics on freshwater biodiversity in urban rivers"'
            value={state.heading}
            onChange={(v) => set("heading", v)}
            error={errs.has("heading")}
          />

          <div>
            <label className="field-label">Academic disciplines</label>
            <MultiSelect
              options={researchDisciplines}
              selected={state.categories}
              onChange={(v) => set("categories", v)}
            />
            <input
              type="text"
              placeholder="Other discipline..."
              value={state.otherDiscipline || ""}
              onChange={(e) => set("otherDiscipline", e.target.value)}
              className="input mt-2"
            />
          </div>

          <div>
            <label className="field-label">Academic level</label>
            <MultiSelect
              options={academicLevels}
              selected={state.levels || []}
              onChange={(v) => set("levels", v)}
            />
          </div>

          <div>
            <label className="field-label">Curriculum</label>
            <MultiSelect
              options={curriculumOptions}
              selected={state.curriculum || []}
              onChange={(v) => set("curriculum", v)}
            />
          </div>

          <Field
            label="Research question"
            required
            placeholder='e.g., "To what extent does exposure to blue light affect melatonin production in adolescents?"'
            value={state.question || ""}
            onChange={(v) => set("question", v)}
            multiline
            error={errs.has("question")}
          />

          <Field
            label="Describe the methodology of the research in depth"
            required
            placeholder="Explain the experimental design, data collection methods, variables..."
            value={state.methodology || ""}
            onChange={(v) => set("methodology", v)}
            multiline
            error={errs.has("methodology")}
          />

          <Field
            label="What data or equipment would be needed?"
            placeholder="e.g., Spectrophotometer, survey software, access to patient records..."
            value={state.equipment || ""}
            onChange={(v) => set("equipment", v)}
            multiline
          />

          <div>
            <label className="field-label">Estimated time to complete</label>
            <SingleSelect
              options={timeEstimates}
              selected={state.time || ""}
              onChange={(v) => set("time", v)}
            />
          </div>

          <Field
            label="What skills or expertise would a researcher need to execute this?"
            placeholder="e.g., Lab experience, statistical analysis (SPSS/R), domain knowledge..."
            value={state.skills || ""}
            onChange={(v) => set("skills", v)}
            multiline
          />
        </>
      )}
    </div>
  );
}

// ─── Helper hook (optional) ───
export function useIdeaForm(initial?: IdeaFormState) {
  const [state, setState] = useState<IdeaFormState>(initial || emptyForm("startup"));
  return [state, setState] as const;
}
