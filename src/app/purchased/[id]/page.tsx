"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { formatScore, formatSubScore, meterFillClass, scoreOrbClass, scoreTone, scoreToneColor, subScoreTo100, subScoreTone } from "@/lib/score-utils";
import { SCORE_LABELS, criterionWeight, scoredCriteria, type IdeaScore } from "@/lib/mock-data";
import AuthForm from "@/components/auth-form";
import InfoDot from "@/components/info-dot";
import AiPreview from "@/components/ai-preview";
import ClarityScore from "@/components/clarity-score";
import { readPreviewParts } from "@/lib/preview";
import { readClarity } from "@/lib/clarity";
import { loadIdeaDetails } from "@/lib/idea-details";
import { EXCLUSIVITY_FULL } from "@/lib/exclusivity";

// ─── Types ───
interface DbIdea {
  id: string;
  user_id: string;
  heading: string;
  idea_type: string;
  categories: string[] | null;
  form_data: Record<string, unknown> | null;
  scores: IdeaScore | null;
  reasonings: Record<string, string> | null;
  overall_score: number | null;
  ai_preview: string | null;
  ai_preview_parts?: unknown;
  clarity_score?: number | null;
  price: number | null;
  exclusivity_price: number | null;
  is_exclusive: boolean;
  exclusive_buyer_id: string | null;
  buy_count: number;
  created_at: string;
}

// AI-preview accuracy scale (stored as the numeric value).
const ACCURACY_OPTIONS: { value: number; label: string }[] = [
  { value: -2, label: "Completely underestimated" },
  { value: -1, label: "Slightly underestimated" },
  { value: 0, label: "Reported accurately" },
  { value: 1, label: "Slightly overestimated" },
  { value: 2, label: "Completely overestimated" },
];

// ─── Detail fields from form_data, by idea type ───
function detailFields(idea: DbIdea): { label: string; value: string }[] {
  const fd = idea.form_data || {};
  const out: { label: string; value: string }[] = [];
  const push = (label: string, v: unknown) => { if (v) out.push({ label, value: String(v) }); };

  if (idea.idea_type === "research") {
    push("Research Question", fd.question);
    push("Methodology", fd.methodology);
    push("Equipment Needed", fd.equipment);
    push("Estimated Time", fd.time);
    push("Skills Needed", fd.skills);
    if (Array.isArray(fd.levels) && fd.levels.length) push("Academic level", (fd.levels as string[]).join(", "));
    if (Array.isArray(fd.curriculum) && fd.curriculum.length) push("Curriculum", (fd.curriculum as string[]).join(", "));
    push("Other discipline", fd.otherDiscipline);
  } else {
    push("Problem", fd.problem);
    push("Solution", fd.solution);
    push("Target Audience", fd.audience);
    push("Differentiator", fd.differentiator);
    push("Skills Needed", fd.skills);
  }
  return out;
}

// ─── Main page ───
export default function PurchasedIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, session, loading: authLoading } = useAuth();

  const [idea, setIdea] = useState<DbIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [notOwned, setNotOwned] = useState(false);

  // Feedback state — persisted automatically on each click (no submit button)
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Exclusivity upgrade
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const fetchIdea = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Confirm the purchase and pull the full idea in one round trip (mirrors
    // the account page; "Buyers can read purchased ideas" RLS allows the embed).
    const { data, error } = await supabase
      .from("purchases")
      .select("ideas(*)")
      .eq("buyer_id", user.id)
      .eq("idea_id", id)
      .maybeSingle();

    if (error) console.error("[purchased] failed to load:", error);

    const row = (data?.ideas as unknown as DbIdea) || null;
    if (!row) {
      setNotOwned(true);
      setLoading(false);
      return;
    }
    // The content this buyer paid for lives in idea_details.
    Object.assign(row, await loadIdeaDetails(id));
    setIdea(row);
    setNotOwned(false);
    setLoading(false);
  }, [user, id]);

  const loadFeedback = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("idea_feedback")
      .select("accuracy, user_rating")
      .eq("user_id", user.id)
      .eq("idea_id", id)
      .maybeSingle();
    if (data) {
      if (typeof data.accuracy === "number") setAccuracy(data.accuracy);
      if (typeof data.user_rating === "number") setUserRating(data.user_rating);
    }
  }, [user, id]);

  useEffect(() => {
    if (!user) return;
    void (async () => { await fetchIdea(); await loadFeedback(); })();
  }, [user, fetchIdea, loadFeedback]);

  // Persist whatever has been answered so far. Either field may still be null —
  // we save partial feedback and update the same row on later clicks.
  const persistFeedback = async (nextAccuracy: number | null, nextRating: number | null) => {
    if (!user || !idea) return;
    setSaveStatus("saving");
    const { error } = await supabase.from("idea_feedback").upsert(
      {
        user_id: user.id,
        idea_id: idea.id,
        accuracy: nextAccuracy,
        user_rating: nextRating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,idea_id" }
    );
    if (error) {
      console.error("[purchased] feedback save failed:", error);
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saved");
  };

  const handleAccuracy = (value: number) => {
    setAccuracy(value);
    void persistFeedback(value, userRating);
  };

  const handleRating = (value: number) => {
    setUserRating(value);
    void persistFeedback(accuracy, value);
  };

  const handleUpgrade = async () => {
    if (!user || !idea) return;
    setUpgrading(true);
    setUpgradeError(null);
    // Securing an idea happens server-side: the browser must not be able to
    // grant itself exclusivity or record a price nobody paid.
    let body: { ok?: boolean; error?: string } = {};
    try {
      const res = await fetch("/api/secure-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ ideaId: idea.id }),
      });
      body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't secure the idea.");
    } catch (err) {
      setUpgrading(false);
      console.error("[purchased] secure failed:", err);
      setUpgradeError(err instanceof Error ? err.message : "Couldn't secure the idea.");
      return;
    }
    setUpgrading(false);
    // Reflect the new exclusive state locally.
    setIdea((prev) => prev ? { ...prev, is_exclusive: true, exclusive_buyer_id: user.id } : prev);
    setShowUpgrade(false);
  };

  // ─── Render states ───
  if (authLoading || (user && loading)) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink">Sign in to view your idea</h1>
        </div>
        <AuthForm defaultMode="login" />
      </div>
    );
  }

  if (notOwned || !idea) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink mb-2">You don&apos;t own this idea</h1>
        <p className="text-neutral-600 mb-6">
          This page is only available for ideas you&apos;ve purchased.
        </p>
        <div className="flex gap-2 justify-center">
          <Link href="/market" className="btn btn-primary">
            Browse the Market
          </Link>
          <Link href="/account?tab=purchased" className="btn btn-secondary">
            My Account
          </Link>
        </div>
      </div>
    );
  }

  const fields = detailFields(idea);
  // After purchase the buyer sees the seller's original heading as the title;
  // the AI-generated public heading moves into the AI Preview section.
  const originalHeading = String((idea.form_data as Record<string, unknown>)?.originalHeading || idea.heading);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Upgrade-to-exclusive confirmation */}
      {showUpgrade && idea.exclusivity_price != null && (
        <div className="dialog-backdrop z-50" onClick={() => !upgrading && setShowUpgrade(false)}>
          <div className="dialog relative max-w-sm w-full p-7" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-ink mb-1">Secure this idea</h2>
            <p className="text-sm text-neutral-600 mb-4">{idea.heading}</p>
            <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 mb-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-neutral-800 uppercase tracking-wide">Secure price</span>
                <span className="text-2xl font-bold text-ink">${idea.exclusivity_price}</span>
              </div>
              <p className="text-xs text-neutral-800/80 mt-2 leading-relaxed">
                This removes the idea from the marketplace, search, and recommendations, so no future rivals can get it.{" "}
                <strong className="text-ink">
                  The {idea.buy_count} {idea.buy_count === 1 ? "person" : "people"} who already bought it {idea.buy_count === 1 ? "keeps" : "keep"} full access.
                </strong>{" "}
                No payment is taken for now — confirm to apply.
              </p>
            </div>
            {upgradeError && <p className="text-xs text-danger mb-3">{upgradeError}</p>}
            <div className="flex gap-3">
              <button onClick={handleUpgrade} disabled={upgrading}
                className="btn btn-dark flex-1">
                {upgrading ? "Processing…" : "Confirm & secure idea"}
              </button>
              <button onClick={() => setShowUpgrade(false)} disabled={upgrading}
                className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <Link href="/account?tab=purchased" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to My Account
      </Link>

      {/* Header card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-accent-700 uppercase">{idea.idea_type}</span>
              <span className="bg-positive text-white text-[10px] font-bold px-2 py-0.5 rounded-full">OWNED</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight">{originalHeading}</h1>
            {idea.categories && idea.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {idea.categories.map((c) => (
                  <span key={c} className="bg-neutral-200 text-neutral-700 text-xs px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            )}
          </div>
          {idea.overall_score != null && (
            <div className="flex flex-col items-center shrink-0">
              <div className={scoreOrbClass(scoreTone(idea.overall_score), "lg")}>
                {formatScore(idea.overall_score)}
              </div>
              <span className="text-[10px] text-neutral-500 mt-1 uppercase tracking-wide">Overall</span>
            </div>
          )}
        </div>
      </div>

      {/* Exclusivity */}
      {idea.is_exclusive ? (
        <div className="bg-neutral-100 border border-neutral-300 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-ink" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <h2 className="text-base font-bold text-ink">
              {idea.exclusive_buyer_id === user.id ? "This idea is secured by you" : "This idea has been secured"}
            </h2>
            <InfoDot text={EXCLUSIVITY_FULL} />
          </div>
          <p className="text-sm text-neutral-800/90">
            {idea.exclusive_buyer_id === user.id
              ? "You removed this idea from the market, so no future rivals can get it. Everyone who already bought it keeps full access — including you."
              : "Another owner removed this idea from the market, so no one new can buy it. You keep full access to it here."}
          </p>
        </div>
      ) : idea.exclusivity_price != null ? (
        <div className="bg-neutral-100 border border-neutral-300 rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-ink" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <h2 className="text-base font-bold text-ink">Like the idea? Avoid future rivals</h2>
                <InfoDot text={EXCLUSIVITY_FULL} />
              </div>
              <p className="text-sm text-neutral-800/90 max-w-md">
                Pay ${idea.exclusivity_price} to remove this idea from the market — so no future rivals can get it too.
              </p>
              <p className="text-xs text-neutral-800/80 mt-1.5">
                {idea.buy_count <= 1
                  ? "You're the first buyer — nobody else has seen this idea yet."
                  : `${idea.buy_count - 1} more ${idea.buy_count - 1 === 1 ? "person" : "people"} bought this idea. They'll keep access.`}
              </p>
            </div>
            <button
              onClick={() => { setUpgradeError(null); setShowUpgrade(true); }}
              className="btn btn-dark shrink-0"
            >
              Secure this idea · ${idea.exclusivity_price}
            </button>
          </div>
        </div>
      ) : null}

      {/* Full idea details */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">Full Idea Details</h2>
        {fields.length > 0 ? (
          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.label} className="card p-4">
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">{f.label}</p>
                <p className="text-sm text-neutral-900 leading-relaxed whitespace-pre-wrap">{f.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No additional details available.</p>
        )}
      </section>

      {/* AI evaluation — per-criterion scores + reasoning */}
      {idea.scores && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">AI Evaluation</h2>
          <div className="space-y-3">
            {scoredCriteria(idea.scores!).map((key) => {
              const score = idea.scores![key] as number;
              const weight = criterionWeight(key);
              const reasoning = idea.reasonings?.[key];
              return (
                <div key={key} className="card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-semibold text-ink">{SCORE_LABELS[key]}</span>
                      {weight != null && (
                        <span className="text-[11px] text-neutral-500 font-medium num whitespace-nowrap">{weight}% weight</span>
                      )}
                    </div>
                    <span className="font-heading font-bold text-[17px] num shrink-0"
                      style={{ color: scoreToneColor(subScoreTone(score)), letterSpacing: "-0.03em" }}>
                      {formatSubScore(score)}
                    </span>
                  </div>
                  <div className="meter mb-2.5">
                    <div className={meterFillClass(subScoreTone(score))} style={{ width: `${subScoreTo100(score)}%` }} />
                  </div>
                  {reasoning && <p className="text-sm text-neutral-700 leading-relaxed">{reasoning}</p>}
                </div>
              );
            })}
          </div>
          <ClarityScore score={readClarity(idea.clarity_score)} className="mt-3" />
        </section>
      )}

      {/* AI preview — placed near the end, just before the feedback block */}
      {idea.ai_preview && (
        <section className="mb-6">
          <AiPreview
            parts={readPreviewParts(idea.ai_preview_parts)}
            text={idea.ai_preview}
            heading={idea.heading !== originalHeading ? idea.heading : null}
            footnote="This is the public heading and preview shown on the Market before purchase."
          />
        </section>
      )}

      {/* Feedback block */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-base font-bold text-ink mb-1">Your feedback</h2>
        <p className="text-sm text-neutral-600 mb-5">
          Now that you&apos;ve seen the full idea, help us calibrate the AI and protect buyers.
        </p>

        {/* AI preview accuracy — 5 options in a line */}
        <div className="mb-6">
          <p className="text-sm font-medium text-neutral-900 mb-1">
            Compared to the full idea, did the AI preview under- or overestimate it?
          </p>
          <p className="text-xs text-neutral-500 mb-3">Pick the option that best matches how the preview represented the idea.</p>
          <div className="grid grid-cols-5 gap-2">
            {ACCURACY_OPTIONS.map((opt) => {
              const active = accuracy === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleAccuracy(opt.value)}
                  className={`flex flex-col items-center text-center rounded-xl border px-2 py-3 transition-colors cursor-pointer ${
                    active
                      ? "border-accent bg-accent-100 text-accent-800"
                      : "border-neutral-300 bg-white text-neutral-700 hover:border-accent-300"
                  }`}
                >
                  <span className={`text-xs font-medium leading-tight ${active ? "text-accent-800" : "text-neutral-700"}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User's own rating 1-10 */}
        <div className="mb-6">
          <p className="text-sm font-medium text-neutral-900 mb-1">How would you rate this idea yourself?</p>
          <p className="text-xs text-neutral-500 mb-3">Your own perception, from 1 (weak) to 10 (excellent).</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = userRating === n;
              return (
                <button
                  key={n}
                  onClick={() => handleRating(n)}
                  className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                    active
                      ? "border-accent bg-accent text-white"
                      : "border-neutral-300 bg-white text-neutral-700 hover:border-accent-300"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-neutral-200">
          {/* Auto-save status — feedback is stored the moment you pick an answer */}
          <span className="text-xs font-medium min-h-[1rem]" aria-live="polite">
            {saveStatus === "saving" && <span className="text-neutral-500">Saving…</span>}
            {saveStatus === "saved" && <span className="text-positive-700">Saved ✓ — your feedback was recorded.</span>}
            {saveStatus === "error" && <span className="text-danger">Couldn&apos;t save — check your connection.</span>}
            {saveStatus === "idle" && <span className="text-neutral-500">Your answers save automatically.</span>}
          </span>

          {/* Report scam — intentionally inert for now */}
          <button
            type="button"
            disabled
            title="Coming soon"
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 border border-neutral-300 rounded-xl px-4 py-2.5 cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            Report scam
          </button>
        </div>
      </section>
    </div>
  );
}
