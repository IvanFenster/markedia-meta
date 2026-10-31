import type { Idea } from "./mock-data";

// In-memory store — persists during session, resets on refresh.
// Starts empty and is populated from Supabase on page load.
let allIdeas: Idea[] = [];
let listeners: (() => void)[] = [];

export function getIdeas(): Idea[] {
  return allIdeas;
}

export function addIdea(idea: Idea) {
  allIdeas = [idea, ...allIdeas];
  listeners.forEach((fn) => fn());
}

/**
 * Replace the store with ideas fetched from Supabase.
 * Replaces the entire list (we no longer mix in mock data).
 */
export function mergeSupabaseIdeas(ideas: Idea[]) {
  allIdeas = [...ideas];
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/**
 * Suggest price based on overall score (0-100 scale).
 * Exponential: score 10 → ~$1, score 100 → $100.
 */
export function suggestPrice(score: number): number {
  const k = Math.log(100) / 90;
  const raw = Math.exp(k * (score - 10));
  return Math.max(1, Math.round(raw));
}

export function generateDefaultPreview(heading: string, type: "startup" | "research"): string {
  if (type === "startup") {
    return `An innovative startup concept centered around "${heading}". The idea proposes a novel approach to solving a significant market problem, with potential for scalability and meaningful impact. The detailed methodology outlines a clear path from concept to execution.`;
  }
  return `A research proposal exploring "${heading}". The study outlines a rigorous methodology for investigating this topic, with clearly defined variables and expected outcomes. The research has potential implications for advancing understanding in its field.`;
}
