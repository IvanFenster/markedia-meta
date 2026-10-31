"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { formatScore, formatSubScore, meterFillClass, scoreOrbClass, scoreTone, scoreToneColor, subScoreTo100 } from "@/lib/score-utils";
import { CRITERIA_KEYS, SCORE_LABELS, criterionWeight, scoredCriteria, type IdeaScore } from "@/lib/mock-data";
import { getScoreExplanation } from "@/lib/score-explanations";
import InfoDot from "@/components/info-dot";
import AiPreview from "@/components/ai-preview";
import ClarityScore from "@/components/clarity-score";
import { ScamClearedNotice } from "@/components/scam-notice";
import { readPreviewParts } from "@/lib/preview";
import { readClarity } from "@/lib/clarity";
import { EXCLUSIVITY_BUYER_NOTE } from "@/lib/exclusivity";

// ─── Types ───
interface PublicIdea {
  id: string;
  user_id: string;
  heading: string;
  categories: string[] | null;
  scores: IdeaScore | null;
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
  buy_count: number;
  status: string;
  created_at: string;
  author?: {
    display_name: string;
    avatar_initials: string;
    nickname?: string;
  };
}

// ─── Auth prompt modal (for Save / Buy when logged out) ───
function AuthPromptModal({
  action,
  ideaId,
  onClose,
}: {
  action: "buy" | "save";
  ideaId: string;
  onClose: () => void;
}) {
  const next = `/ideas/${ideaId}`;
  const label = action === "buy" ? "buy" : "save";
  return (
    <div
      className="dialog-backdrop z-50"
      onClick={onClose}
    >
      <div
        className="dialog max-w-md w-full p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-ink mb-1">Sign in to {label}</h2>
        <p className="text-sm text-neutral-700 mb-5">
          You need an account to {label} this idea. Creating one is free and takes a few seconds.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="btn btn-secondary flex-1"
          >
            Cancel
          </button>
          <Link
            href={`/account?mode=login&next=${encodeURIComponent(next)}`}
            className="flex-1 px-4 py-2.5 border border-accent text-accent-700 hover:bg-accent-100 text-sm font-medium rounded-lg transition-colors text-center"
          >
            Log in
          </Link>
          <Link
            href={`/account?mode=signup&next=${encodeURIComponent(next)}`}
            className="btn btn-primary flex-1 text-center"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Buy confirmation modal ───
function BuyConfirmModal({
  idea,
  onClose,
  onPurchased,
}: {
  idea: PublicIdea;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const { user, session } = useAuth();
  const [state, setState] = useState<"confirm" | "processing" | "success" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!user) {
      setErrorMsg("You need to be logged in.");
      setState("error");
      return;
    }
    setState("processing");
    try {
      // The purchase is recorded server-side: the browser must not be able to
      // grant itself access or decide what was paid.
      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ ideaId: idea.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Purchase failed");

      // buy_count is maintained by an AFTER INSERT trigger on purchases.
      setState("success");
      onPurchased();
    } catch (err) {
      console.error("Purchase failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "Purchase failed");
      setState("error");
    }
  };

  return (
    <div
      className="dialog-backdrop z-50"
      onClick={state === "processing" ? undefined : onClose}
    >
      <div
        className="dialog max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {state === "success" ? (
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-positive-100 text-positive-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-ink mb-2">Purchase complete</h2>
            <p className="text-sm text-neutral-700 mb-6">
              &ldquo;{idea.heading}&rdquo; is now in your account.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="btn btn-secondary flex-1"
              >
                Close
              </button>
              <Link
                href={`/purchased/${idea.id}`}
                className="btn btn-primary flex-1 text-center"
              >
                View the idea
              </Link>
            </div>
          </div>
        ) : state === "error" ? (
          <div className="p-6 text-center">
            <h2 className="text-xl font-bold text-ink mb-2">Something went wrong</h2>
            <p className="text-sm text-neutral-700 mb-5">{errorMsg ?? "Please try again."}</p>
            <button
              onClick={onClose}
              className="btn btn-primary w-full"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-xl font-bold text-ink mb-1">Confirm purchase</h2>
              <p className="text-sm text-neutral-600">Review the details before you pay.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-ink leading-snug">
                  {idea.heading}
                </h3>
                {idea.author && (
                  <p className="text-xs text-neutral-600 mt-1">
                    by <span className="font-medium text-neutral-800">{idea.author.display_name}</span>
                  </p>
                )}
              </div>
              <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 flex items-baseline justify-between">
                <div>
                  <p className="text-xs text-neutral-600 uppercase tracking-wide">Price</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    No payment required for now — confirm to unlock instantly.
                  </p>
                </div>
                <div className="text-3xl font-bold text-ink">${idea.price}</div>
              </div>
              <div className="border border-accent-200 bg-accent-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-accent-700 uppercase tracking-wide mb-2">
                  What you&apos;ll unlock
                </p>
                <ul className="text-sm text-neutral-800 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">✓</span>
                    <span>The full problem statement and proposed solution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">✓</span>
                    <span>Target audience, differentiator, and skills the author identified</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">✓</span>
                    <span>The complete AI evaluation with detailed reasoning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">✓</span>
                    <span>Permanent access from your account page</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-2">
              <button
                onClick={onClose}
                disabled={state === "processing"}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={state === "processing"}
                className="btn btn-primary flex-1 justify-center"
              >
                {state === "processing" ? "Processing…" : "Confirm & Unlock"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Expandable score row with pre-written explanation ───
function ScoreRow({
  criterion,
  score,
}: {
  criterion: keyof IdeaScore;
  score: number;
}) {
  const [open, setOpen] = useState(false);
  const color100 = subScoreTo100(score);
  const weight = criterionWeight(criterion);
  const { rangeLabel, text } = getScoreExplanation(criterion, score);

  const tone = scoreTone(color100);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-5 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <svg
              className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-[14.5px] font-semibold text-ink">{SCORE_LABELS[criterion]}</span>
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
          <div className={meterFillClass(tone)} style={{ width: `${color100}%` }} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-neutral-200 bg-neutral-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600 mt-3 mb-1.5">
            What a {rangeLabel} score means
          </p>
          <p className="text-sm text-neutral-800 leading-relaxed">{text}</p>
          <p className="text-[11px] text-neutral-500 italic mt-2">
            General guidance for this score range — not a description of this idea.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Locked scores preview for logged-out users ───
function LockedScores() {
  return (
    <div className="relative">
      <div className="space-y-2 blur-sm select-none pointer-events-none">
        {CRITERIA_KEYS.map((key) => (
          <div key={key} className="card p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-900">{SCORE_LABELS[key]}</span>
            <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full bg-gray-400">?.?</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 rounded-xl">
        <p className="text-sm text-neutral-800 font-medium mb-2">Log in to see the detailed scores</p>
        <div className="flex gap-2">
          <Link
            href="/account?mode=login"
            className="border border-accent text-accent-700 hover:bg-accent-100 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/account?mode=signup"
            className="btn btn-primary"
          >
            Sign up free
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───
export default function PublicIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();

  const [idea, setIdea] = useState<PublicIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<"buy" | "save" | null>(null);

  // Fetch idea + author profile
  const fetchIdea = useCallback(async () => {
    setLoading(true);

    const ideaRes = await supabase
      .from("ideas")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();

    if (ideaRes.error) {
      console.error("[ideas] failed to load idea:", ideaRes.error);
    }

    const row = ideaRes.data as PublicIdea | null;
    if (!row) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Fetch the author profile in a second round trip (keeps it resilient
    // to schema-cache FK gaps — matches the Market page's approach).
    const profileRes = await supabase
      .from("profiles")
      .select("display_name, avatar_initials, nickname")
      .eq("id", row.user_id)
      .maybeSingle();

    row.author = {
      display_name: (profileRes.data?.display_name as string) || "Unknown",
      avatar_initials: (profileRes.data?.avatar_initials as string) || "??",
      nickname: (profileRes.data?.nickname as string) || undefined,
    };

    setIdea(row);
    setNotFound(false);
    setLoading(false);
  }, [id]);

  // Load purchase + save state for this user + idea
  const loadUserState = useCallback(async () => {
    if (!user) {
      setPurchased(false);
      setSaved(false);
      return;
    }
    const [purchaseRes, savedRes] = await Promise.all([
      supabase
        .from("purchases")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("idea_id", id)
        .maybeSingle(),
      supabase
        .from("saved_ideas")
        .select("id")
        .eq("user_id", user.id)
        .eq("idea_id", id)
        .maybeSingle(),
    ]);
    setPurchased(!!purchaseRes.data);
    setSaved(!!savedRes.data);
  }, [user, id]);

  useEffect(() => {
    void (async () => { await fetchIdea(); })();
  }, [fetchIdea]);

  useEffect(() => {
    void (async () => { await loadUserState(); })();
  }, [loadUserState]);

  const handleToggleSave = async () => {
    if (!user) {
      setAuthPrompt("save");
      return;
    }
    if (!idea) return;
    setSavingToggle(true);
    if (saved) {
      const { error } = await supabase
        .from("saved_ideas")
        .delete()
        .eq("user_id", user.id)
        .eq("idea_id", idea.id);
      if (error) console.error("[ideas] unsave failed:", error);
      else setSaved(false);
    } else {
      const { error } = await supabase
        .from("saved_ideas")
        .insert({ user_id: user.id, idea_id: idea.id });
      // Treat duplicate as success
      if (error && !/duplicate|unique/i.test(error.message)) {
        console.error("[ideas] save failed:", error);
      } else {
        setSaved(true);
      }
    }
    setSavingToggle(false);
  };

  const handleBuyClick = () => {
    if (!user) {
      setAuthPrompt("buy");
      return;
    }
    setShowBuy(true);
  };

  // ─── Render states ───
  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (notFound || !idea) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink mb-2">Idea not found</h1>
        <p className="text-neutral-600 mb-6">
          It may have been unpublished, deleted, or never existed.
        </p>
        <Link
          href="/market"
          className="btn btn-primary"
        >
          Back to Market
        </Link>
      </div>
    );
  }

  const isOwner = !!user && idea.user_id === user.id;

  // Exclusive ideas are off the market: only the seller and existing buyers may
  // see them. Everyone else gets a "no longer available" notice at the old link.
  if (idea.is_exclusive && !isOwner && !purchased) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-neutral-200 text-neutral-500 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">This idea is no longer available</h1>
        <p className="text-neutral-600 mb-6 max-w-md mx-auto">
          It was secured by a buyer and taken off the market, so it can&apos;t be purchased anymore. Everyone who already bought it keeps full access in their account.
        </p>
        <Link href="/market" className="btn btn-primary">
          Browse the Market
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {showBuy && (
        <BuyConfirmModal
          idea={idea}
          onClose={() => setShowBuy(false)}
          onPurchased={() => {
            setPurchased(true);
            void loadUserState();
          }}
        />
      )}
      {authPrompt && (
        <AuthPromptModal
          action={authPrompt}
          ideaId={idea.id}
          onClose={() => setAuthPrompt(null)}
        />
      )}

      {/* Breadcrumb */}
      <Link href="/market" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Market
      </Link>

      {/* Owner banner — author sees the same public page buyers see, plus a way back to the Lab */}
      {isOwner && (
        <div className="mb-6 bg-accent-100 border border-accent-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-accent-200 text-accent-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-accent-800">This is your idea</p>
              <p className="text-xs text-accent-700/80 mt-0.5 leading-relaxed">
                You&apos;re viewing the exact public page buyers see. Edit it, re-evaluate, change the price, or unpublish from your Ideas Lab.
              </p>
            </div>
          </div>
          <Link
            href={`/lab/${idea.id}`}
            className="btn btn-primary shrink-0 inline-flex justify-center"
          >
            See it in your Ideas Lab
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      )}

      {/* Header card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight">
              {idea.heading}
            </h1>
            <div className="flex items-center gap-2 mt-3">
              <div className="w-8 h-8 rounded-full bg-accent-200 text-accent-800 text-xs font-bold flex items-center justify-center shrink-0">
                {idea.author?.avatar_initials || "??"}
              </div>
              {idea.author?.nickname ? (
                <Link href={`/u/${idea.author.nickname}`} className="text-sm text-accent-700 font-medium hover:underline">
                  {idea.author?.display_name || "Unknown"}
                </Link>
              ) : (
                <span className="text-sm text-accent-700 font-medium">
                  {idea.author?.display_name || "Unknown"}
                </span>
              )}
            </div>
            {idea.categories && idea.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {idea.categories.map((cat) => (
                  <span key={cat} className="bg-neutral-200 text-neutral-700 text-xs px-2 py-0.5 rounded-full">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
          {idea.overall_score != null && (
            <div className="flex flex-col items-center shrink-0">
              <div className={scoreOrbClass(scoreTone(idea.overall_score), "lg")}>
                {formatScore(idea.overall_score)}
              </div>
              <span className="text-[10px] text-neutral-500 mt-1 uppercase tracking-wide">
                Overall
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout: preview/actions left, scores right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* Left: AI preview + pricing/action card */}
        <div className="space-y-6">
          {/* Abuse check passed — reassures buyers before they pay */}
          {idea.scores != null && !idea.scam_flagged && <ScamClearedNotice />}

          {/* AI Preview (always visible) */}
          <AiPreview
            parts={readPreviewParts(idea.ai_preview_parts)}
            text={idea.ai_preview || "No preview available for this idea."}
            footnote="The preview summarises the idea without revealing its full content. Buy the idea to see the detailed problem, solution, and the author's reasoning."
          />

          {/* Purchase card */}
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide">Price</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-3xl font-bold text-ink">${idea.price ?? 0}</span>
                  {idea.suggested_price != null && idea.price !== idea.suggested_price && (
                    <span className="text-xs text-neutral-500 line-through">AI suggested: ${idea.suggested_price}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 bg-neutral-200 text-neutral-800 text-sm font-semibold px-3 py-1.5 rounded-full">
                  <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                  {idea.buy_count} {idea.buy_count === 1 ? "buyer" : "buyers"}
                </span>
              </div>
            </div>

            {/* Exclusivity is available but not buyable here — buyers upgrade after purchase */}
            {idea.exclusivity_price != null && !idea.is_exclusive && !purchased && (
              <div className="mb-4 flex items-start gap-2 bg-neutral-100 border border-neutral-200 rounded-xl p-3">
                <svg className="w-4 h-4 text-neutral-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <div className="text-xs text-ink">
                  <span className="font-semibold">Can be secured for ${idea.exclusivity_price}</span>
                  <InfoDot text={EXCLUSIVITY_BUYER_NOTE} className="ml-1.5" />
                  <p className="text-neutral-800/80 mt-0.5 leading-relaxed">
                    {isOwner
                      ? "You let buyers secure this idea. A buyer who owns it can pay this to take it off the market; everyone who already bought it keeps access."
                      : "Buy at the regular price first — then you can secure it to take it off the market. Everyone who already bought it keeps access."}
                  </p>
                </div>
              </div>
            )}

            {isOwner ? (
              <>
                <Link
                  href={`/lab/${idea.id}`}
                  className="btn btn-primary w-full text-center justify-center"
                >
                  Manage in your Ideas Lab
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
                  This is your listing — buyers see this price and preview. Change the price or edit the idea from your Ideas Lab.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  {purchased ? (
                    <Link
                      href="/account?tab=purchased"
                      className="flex-1 bg-positive-100 text-positive-700 border border-positive hover:bg-positive-100 text-sm font-medium py-3 rounded-xl transition-colors text-center flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Owned — open in My Account
                    </Link>
                  ) : (
                    <button
                      onClick={handleBuyClick}
                      className="btn btn-primary flex-1"
                    >
                      {user ? "Buy Idea" : "Sign up to Buy"}
                    </button>
                  )}

                  {/* Save-for-later button — hidden once owned */}
                  {!purchased && (
                    <button
                      onClick={handleToggleSave}
                      disabled={savingToggle}
                      className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 ${
                        saved
                          ? "bg-accent-100 border-accent-200 text-accent-700 hover:bg-accent-100"
                          : "bg-white border-neutral-300 text-neutral-800 hover:border-accent-300 hover:text-accent-700"
                      }`}
                      title={saved ? "Remove from your Saved list" : "Save this idea to decide later"}
                    >
                      <svg
                        className="w-4 h-4"
                        fill={saved ? "currentColor" : "none"}
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                      </svg>
                      {saved ? "Saved for later" : "Save for later"}
                    </button>
                  )}
                </div>

                {!purchased && (
                  <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
                    Saving keeps the idea on your account so you can come back and decide whether to buy it.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Score breakdown with expandable explanations */}
        <aside className="space-y-3 lg:self-start">
          <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">
            AI Score Breakdown
          </h2>

          {!user ? (
            <LockedScores />
          ) : idea.scores ? (
            <>
              <p className="text-xs text-neutral-600 leading-relaxed mb-2">
                Each criterion is scored out of 10. The percentage is how much that criterion
                counts toward the overall rating — not the score itself. Click any row to read what
                a score in that range means.
              </p>
              {scoredCriteria(idea.scores).map((key) => (
                <ScoreRow key={key} criterion={key} score={idea.scores![key] as number} />
              ))}
              <ClarityScore score={readClarity(idea.clarity_score)} className="mt-4" />
            </>
          ) : (
            <div className="bg-neutral-100 border border-dashed border-neutral-300 rounded-2xl p-6 text-center">
              <p className="text-sm text-neutral-600">This idea doesn&apos;t have AI scores yet.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
