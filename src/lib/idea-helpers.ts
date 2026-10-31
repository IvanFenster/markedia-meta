import type { IdeaScore } from "./mock-data";

// ─── DB row shape ───
export interface DbIdea {
  id: string;
  user_id: string;
  heading: string;
  idea_type: "startup" | "research";
  categories: string[] | null;
  form_data: Record<string, unknown> | null;
  scores: IdeaScore | null;
  reasonings: Record<string, string> | null;
  overall_score: number | null;
  ai_preview: string | null;
  ai_preview_parts?: unknown;
  clarity_score?: number | null;
  scam_flagged?: boolean;
  scam_reasons?: string[];
  scam_review_requested?: boolean;
  price: number | null;
  suggested_price: number | null;
  exclusivity_price: number | null;
  is_exclusive: boolean;
  exclusive_buyer_id: string | null;
  exclusive_at: string | null;
  exclusive_price_paid: number | null;
  buy_count: number;
  status: IdeaStatus;
  evaluated_snapshot: EvaluatedSnapshot | null;
  archived_at: string | null;
  created_at: string;
}

export type IdeaStatus = "draft" | "unpublished" | "published" | "archived";

export interface EvaluatedSnapshot {
  heading: string;
  categories: string[];
  form_data: Record<string, unknown>;
}

// ─── Status display ───
export const STATUS_LABEL: Record<IdeaStatus, string> = {
  draft: "Draft",
  unpublished: "Unpublished",
  published: "Published",
  archived: "Archived",
};

/** Ember badge variants — pair with the base `.badge` class. */
export const STATUS_BADGE_CLASS: Record<IdeaStatus, string> = {
  draft: "badge-draft",
  unpublished: "badge-unpublished",
  published: "badge-published",
  archived: "badge-archived",
};

// ─── Dirty detection ───
/**
 * True if the idea has been edited since its last AI evaluation.
 * Used to gate the "Re-evaluate" button.
 *
 * If the idea has never been evaluated (no snapshot), returns false —
 * the action you want is "Evaluate", not "Re-evaluate".
 */
export function isEvaluationStale(idea: DbIdea): boolean {
  if (!idea.scores || !idea.evaluated_snapshot) return false;
  const snap = idea.evaluated_snapshot;
  const currentCats = idea.categories || [];
  const currentForm = idea.form_data || {};
  return (
    snap.heading !== idea.heading ||
    JSON.stringify(snap.categories || []) !== JSON.stringify(currentCats) ||
    JSON.stringify(snap.form_data || {}) !== JSON.stringify(currentForm)
  );
}

export function buildSnapshot(
  heading: string,
  categories: string[],
  formData: Record<string, unknown>
): EvaluatedSnapshot {
  return { heading, categories, form_data: formData };
}

// ─── Required fields by type (used by client validation + evaluation gate) ───
export function getEvaluatableProblem(idea: DbIdea): string {
  const fd = idea.form_data || {};
  return String(fd.problem || fd.question || "");
}

export function getEvaluatableSolution(idea: DbIdea): string {
  const fd = idea.form_data || {};
  return String(fd.solution || fd.methodology || "");
}

export function canEvaluate(idea: DbIdea): boolean {
  return !!(
    idea.heading?.trim() &&
    getEvaluatableProblem(idea).trim() &&
    getEvaluatableSolution(idea).trim()
  );
}

// ─── Sort helpers ───
export type SortKey = "newest" | "oldest" | "score-high" | "score-low" | "price-high" | "price-low";

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "score-high": "AI score: high → low",
  "score-low": "AI score: low → high",
  "price-high": "Price: high → low",
  "price-low": "Price: low → high",
};

export function sortIdeas(ideas: DbIdea[], key: SortKey): DbIdea[] {
  const arr = [...ideas];
  switch (key) {
    case "newest":
      return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "oldest":
      return arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "score-high":
      return arr.sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));
    case "score-low":
      return arr.sort((a, b) => (a.overall_score ?? 999) - (b.overall_score ?? 999));
    case "price-high":
      return arr.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    case "price-low":
      return arr.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  }
}

// ─── Field metadata for the form (single source of truth) ───
// Primary 15 — shown by default on the form.
export const startupCategoriesPrimary = [
  "AI / ML",
  "FinTech",
  "HealthTech",
  "Education",
  "SaaS / B2B",
  "Marketplace",
  "E-commerce",
  "Sustainability",
  "Cybersecurity",
  "Social",
  "Entertainment",
  "Logistics",
  "Agriculture",
  "Hardware",
  "HR / Productivity",
];

// Additional 20 — revealed via "Show more".
export const startupCategoriesExtra = [
  "BioTech",
  "LegalTech",
  "Blockchain / Web3",
  "Travel / Mobility",
  "PropTech",
  "InsurTech",
  "AdTech",
  "Robotics",
  "AR / VR",
  "Space",
  "Smart City",
  "Fashion",
  "Sports",
  "Art",
  "Parenting",
  "Pet Tech",
  "Government",
  "Personal Finance",
  "Drones",
];

/** Full combined list (used when rendering stored values that might be from either group). */
export const startupCategories = [...startupCategoriesPrimary, ...startupCategoriesExtra];

export const researchDisciplines = [
  "Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "Robotics/AI",
  "Economics", "Business/Management", "Psychology", "Sociology", "Philosophy", "History",
  "Geography", "Environmental Science", "Political Science", "Law", "Linguistics", "Literature",
  "Art History", "Music", "Engineering", "Medicine/Health Sciences", "Neuroscience",
  "Astronomy/Astrophysics", "Earth Sciences/Geology", "Ecology", "Statistics", "Data Science",
  "Anthropology", "Archaeology", "Education Studies", "Media/Communications", "Design",
  "Architecture", "Sports Science", "Nutrition/Food Science", "Pharmacology", "Materials Science",
];

export const academicLevels = [
  "High school", "Undergraduate", "Master's", "PhD", "Post-doctoral / professional publication",
];

export const curriculumOptions = [
  "IB Internal Assessment (IA)", "IB Extended Essay (EE)", "A-Level NEA", "A-Level EPQ",
  "AP Research", "AP Seminar",
];

export const timeEstimates = [
  "A few days", "1-2 weeks", "1 month", "2-3 months", "One semester", "Two semesters",
  "1+ year", "Ongoing / open-ended",
];
