"use client";

import { useState, useMemo, useEffect, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categories, type Idea, type IdeaScore } from "@/lib/mock-data";
import { getIdeas, subscribe, mergeSupabaseIdeas } from "@/lib/ideas-store";
import { formatScore, scoreOrbClass, scoreTone } from "@/lib/score-utils";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { previewSummary, readPreviewParts } from "@/lib/preview";

// ---------- Auth prompt modal (shown when logged-out user clicks Buy) ----------
function AuthPromptModal({
  idea,
  onClose,
}: {
  idea: Idea;
  onClose: () => void;
}) {
  return (
    <div
      className="dialog-backdrop z-50"
      onClick={onClose}
    >
      <div
        className="dialog max-w-md w-full p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-ink">Sign in to buy</h2>
        </div>
        <p className="text-sm text-neutral-700 mb-5">
          You need an account to purchase &ldquo;{idea.heading}&rdquo;. Create one in seconds
          — it&apos;s free.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="btn btn-secondary flex-1"
          >
            Cancel
          </button>
          <Link
            href={`/account?mode=login&next=/market#idea-${idea.id}`}
            className="flex-1 px-4 py-2.5 border border-accent text-accent-700 hover:bg-accent-100 text-sm font-medium rounded-lg transition-colors text-center"
          >
            Log in
          </Link>
          <Link
            href={`/account?mode=signup&next=/market#idea-${idea.id}`}
            className="btn btn-primary flex-1 text-center"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------- Buy confirmation modal ----------
function BuyConfirmModal({
  idea,
  onClose,
  onPurchased,
}: {
  idea: Idea;
  onClose: () => void;
  onPurchased: (ideaId: string) => void;
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
      onPurchased(idea.id);
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
              &ldquo;{idea.heading}&rdquo; is now in your account. Read the full idea,
              evaluation, and author notes anytime.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="btn btn-secondary flex-1"
              >
                Continue Browsing
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
            <div className="w-14 h-14 rounded-full bg-danger-100 text-danger flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
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

            <div className="p-6 space-y-5">
              {/* Idea summary */}
              <div>
                <h3 className="text-base font-semibold text-ink leading-snug">
                  {idea.heading}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-5 h-5 rounded-full bg-accent-200 text-accent-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idea.author.avatar}
                  </div>
                  <span className="text-xs text-neutral-600">
                    by <span className="font-medium text-neutral-800">{idea.author.name}</span>
                  </span>
                  <span className={`ml-auto ${scoreOrbClass(scoreTone(idea.overallScore), "sm")}`}>
                    {formatScore(idea.overallScore)}
                  </span>
                </div>
              </div>

              {/* Price summary */}
              <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 flex items-baseline justify-between">
                <div>
                  <p className="text-xs text-neutral-600 uppercase tracking-wide">Listed Price</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    No payment required for now — confirm to unlock instantly.
                  </p>
                </div>
                <div className="text-3xl font-bold text-ink">${idea.price}</div>
              </div>

              {/* What you unlock */}
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
                    <span>The complete AI evaluation with reasoning for every score</span>
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
                {state === "processing" ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Processing…
                  </>
                ) : (
                  <>Confirm &amp; Unlock</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Idea Card ----------
function IdeaCard({
  idea,
  isOwner,
  isPurchased,
  onBuyClick,
}: {
  idea: Idea;
  isOwner: boolean;
  isPurchased: boolean;
  onBuyClick: (idea: Idea) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  // Everyone — including the author — opens the public idea page. The author
  // gets an "open in your Ideas Lab" banner there instead of an auto-redirect.
  const cardHref = `/ideas/${idea.id}`;

  return (
    <article id={`idea-${idea.id}`} className="card card-lift flex flex-col">
      {/* Clickable area → opens the full idea page */}
      <Link href={cardHref} className="block px-5 pt-5 pb-3.5 no-underline">
        <div className="flex gap-3.5 items-start">
          <div className="flex-1 min-w-0">
            {(isOwner || isPurchased) && (
              <span className={`badge mb-2.5 ${isOwner ? "badge-live" : "badge-owned"}`}>
                {isOwner ? "Your listing" : "Owned"}
              </span>
            )}
            <h4 className="text-[19px] text-ink mb-3 hover:text-accent-700 transition-colors">
              {idea.heading}
            </h4>
            <div className="flex items-center gap-2">
              <span className="avatar">{idea.author.avatar}</span>
              {idea.author.nickname ? (
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/u/${idea.author.nickname}`); }}
                  className="text-[13px] font-semibold text-neutral-700 hover:text-ink hover:underline cursor-pointer"
                >
                  {idea.author.name}
                </span>
              ) : (
                <span className="text-[13px] font-semibold text-neutral-700">{idea.author.name}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <div className={scoreOrbClass(scoreTone(idea.overallScore))}>
              {formatScore(idea.overallScore)}
            </div>
            <span className="score-label">Score</span>
          </div>
        </div>
      </Link>

      {idea.categories.length > 0 && (
        <div className="px-5 flex flex-wrap gap-1.5">
          {idea.categories.slice(0, 3).map((cat) => (
            <span key={cat} className="tag">{cat}</span>
          ))}
        </div>
      )}

      <div className="ai-preview mx-5 mt-4">
        <span className="kicker">AI preview</span>
        <p className="mt-1.5 text-sm leading-[1.5] line-clamp-4">{previewSummary(idea.aiPreviewParts, idea.aiPreview)}</p>
      </div>

      {/* Price, secure offer, buy count */}
      <div className="mt-auto pt-3.5 px-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="price text-[25px]">${idea.price}</span>
            {idea.price !== idea.suggestedPrice && idea.suggestedPrice > 0 && (
              <span className="text-xs text-neutral-500 line-through num">AI ${idea.suggestedPrice}</span>
            )}
          </div>
          {idea.exclusivityPrice != null && (
            <span className="badge badge-secured mt-1.5 num">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="11" rx="1.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Secure for ${idea.exclusivityPrice}
            </span>
          )}
        </div>
        <span className="text-[12.5px] font-semibold text-neutral-600 num whitespace-nowrap shrink-0">
          {idea.buyCount} bought
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-5 pt-4">
        {isOwner ? (
          <Link href={`/lab/${idea.id}`} className="btn btn-dark btn-sm flex-1">
            Open in Lab
          </Link>
        ) : isPurchased ? (
          <Link href={`/purchased/${idea.id}`} className="btn btn-secondary btn-sm flex-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Open full idea
          </Link>
        ) : (
          <>
            <Link href={`/ideas/${idea.id}`} className="btn btn-secondary btn-sm flex-1">
              View
            </Link>
            <button onClick={() => onBuyClick(idea)} className="btn btn-primary btn-sm flex-1">
              {user ? "Buy idea" : "Sign up to buy"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

// ---------- Sort options ----------
type SortOption = "trending" | "newest" | "top-rated" | "most-bought" | "price-low" | "price-high" | "exclusive";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "New Ideas" },
  { value: "top-rated", label: "Top Rated" },
  { value: "most-bought", label: "Most Bought" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "exclusive", label: "Can Be Secured" },
];

// ---------- Market Page ----------
export default function MarketPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sort, setSort] = useState<SortOption>("trending");
  const [aiQuery, setAiQuery] = useState("");
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [buyIdea, setBuyIdea] = useState<Idea | null>(null);
  const [authPromptIdea, setAuthPromptIdea] = useState<Idea | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  const allIdeas = useSyncExternalStore(subscribe, getIdeas, getIdeas);

  // Load the current user's purchased idea IDs
  const loadPurchased = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("purchases")
      .select("idea_id")
      .eq("buyer_id", user.id);
    if (error) {
      console.error("[market] failed to load purchases:", error);
      return;
    }
    if (data) {
      setPurchasedIds(new Set(data.map((r: { idea_id: string }) => r.idea_id)));
    }
  }, [user]);

  useEffect(() => {
    async function run() {
      await loadPurchased();
    }
    run();
  }, [loadPurchased]);

  const handleBuyClick = (idea: Idea) => {
    if (!user) {
      setAuthPromptIdea(idea);
      return;
    }
    setBuyIdea(idea);
  };

  const handlePurchased = (ideaId: string) => {
    // Optimistically mark as owned so the card updates immediately
    setPurchasedIds((prev) => {
      const next = new Set(prev);
      next.add(ideaId);
      return next;
    });
    // Also refresh authoritative state from the DB
    loadPurchased();
  };

  // Load published ideas from Supabase on mount
  useEffect(() => {
    async function loadSupabaseIdeas() {
      // 1) Fetch published ideas. We DON'T embed profiles here — once the
      //    supabase-fix.sql migration is applied, an embed via the new FK
      //    works, but doing two queries keeps this resilient and cheap.
      const ideasRes = await supabase
        .from("ideas")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (ideasRes.error) {
        console.error("[market] failed to load ideas:", ideasRes.error);
        return;
      }
      // Exclusive ideas are removed from listings/search/recommendations.
      // Filtered client-side so it also works before the exclusivity migration.
      const rows = (ideasRes.data ?? []).filter((r) => !r.is_exclusive);
      if (rows.length === 0) return;

      // 2) Fetch every author profile in one round trip.
      const userIds = Array.from(
        new Set(rows.map((r) => r.user_id as string).filter(Boolean))
      );
      const profilesRes = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, display_name, avatar_initials, nickname")
            .in("id", userIds)
        : { data: [], error: null };

      if (profilesRes.error) {
        console.error("[market] failed to load profiles:", profilesRes.error);
      }

      const profileMap = new Map<string, { display_name?: string; avatar_initials?: string; nickname?: string }>();
      (profilesRes.data ?? []).forEach((p) => {
        profileMap.set(p.id as string, {
          display_name: p.display_name as string | undefined,
          avatar_initials: p.avatar_initials as string | undefined,
          nickname: p.nickname as string | undefined,
        });
      });

      const mapped = rows.map((row: Record<string, unknown>) => {
        const profile = profileMap.get(row.user_id as string);
        const scores = row.scores as IdeaScore;
        return {
          id: row.id as string,
          userId: row.user_id as string,
          heading: row.heading as string,
          author: {
            name: profile?.display_name || "Unknown",
            avatar: profile?.avatar_initials || "??",
            rating: 5.0,
            nickname: profile?.nickname,
          },
          categories: (row.categories as string[]) || [],
          overallScore: (row.overall_score as number) || 0,
          scores,
          aiPreview: (row.ai_preview as string) || "",
          aiPreviewParts: readPreviewParts(row.ai_preview_parts),
          price: (row.price as number) || 0,
          suggestedPrice: (row.suggested_price as number) || 0,
          exclusivityPrice: (row.exclusivity_price as number | null) ?? null,
          buyCount: (row.buy_count as number) || 0,
          createdAt: ((row.created_at as string) || "").split("T")[0],
          trending: false,
        } satisfies Idea;
      });

      mergeSupabaseIdeas(mapped);
    }
    loadSupabaseIdeas();
  }, []);

  const filteredIdeas = useMemo(() => {
    let ideas = [...allIdeas];

    if (search.trim()) {
      const q = search.toLowerCase();
      ideas = ideas.filter(
        (idea) =>
          idea.heading.toLowerCase().includes(q) ||
          idea.aiPreview.toLowerCase().includes(q) ||
          idea.categories.some((c) => c.toLowerCase().includes(q)) ||
          idea.author.name.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== "All") {
      ideas = ideas.filter((idea) => idea.categories.includes(selectedCategory));
    }

    switch (sort) {
      case "trending":
        ideas.sort(
          (a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0) || b.overallScore - a.overallScore
        );
        break;
      case "newest":
        ideas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "top-rated":
        ideas.sort((a, b) => b.overallScore - a.overallScore);
        break;
      case "most-bought":
        ideas.sort((a, b) => b.buyCount - a.buyCount);
        break;
      case "price-low":
        ideas.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        ideas.sort((a, b) => b.price - a.price);
        break;
      case "exclusive":
        // Ideas that can be secured first (cheapest secure price on top), the rest after by score.
        ideas.sort((a, b) => {
          const ae = a.exclusivityPrice != null, be = b.exclusivityPrice != null;
          if (ae !== be) return ae ? -1 : 1;
          if (ae && be) return (a.exclusivityPrice ?? 0) - (b.exclusivityPrice ?? 0);
          return b.overallScore - a.overallScore;
        });
        break;
    }

    return ideas;
  }, [allIdeas, search, selectedCategory, sort]);

  // Median of the live listings, shown in the page head.
  const medianScore = useMemo(() => {
    const scores = allIdeas.map((i) => i.overallScore).filter((s) => s > 0).sort((a, b) => a - b);
    if (scores.length === 0) return null;
    const mid = Math.floor(scores.length / 2);
    const raw = scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
    return formatScore(raw);
  }, [allIdeas]);

  return (
    <div className="max-w-[1280px] mx-auto px-8 pt-14">
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <span className="kicker">Market</span>
          <h1 className="mt-3 text-[clamp(38px,4.6vw,60px)]">Market of ideas</h1>
          <p className="mt-3.5 max-w-[56ch] text-base text-neutral-700">
            Discover, evaluate, and acquire ideas from visioners around the world.
          </p>
        </div>
        <div className="flex gap-8 pb-1.5">
          <div>
            <div className="stat-num num">{allIdeas.length}</div>
            <div className="stat-label">Ideas live</div>
          </div>
          <div>
            <div className="stat-num num">{medianScore ?? "—"}</div>
            <div className="stat-label">Median score</div>
          </div>
        </div>
      </div>

      <div className="hr my-9" />

      {/* Search */}
      <div className="flex gap-2.5 items-stretch">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            placeholder="Search ideas by keyword, category, or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-11 min-h-12"
          />
        </div>
        <button
          onClick={() => setShowAiSearch(!showAiSearch)}
          className={`btn ${showAiSearch ? "btn-primary" : "btn-dark"} min-h-12`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
          </svg>
          <span className="hidden sm:inline">AI search</span>
        </button>
      </div>

      {showAiSearch && (
        <div className="panel-accent mt-3 p-[18px]" style={{ borderRadius: "var(--radius-md)" }}>
          <span className="kicker">Describe what you&apos;re looking for</span>
          <div className="flex gap-2.5 mt-2.5 items-end">
            <textarea
              rows={2}
              placeholder="e.g. a startup idea in the health sector with high social impact that a small team could build…"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              className="input min-h-16"
            />
            <button className="btn btn-primary min-h-12">Find</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-start justify-between gap-5 mt-6">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`chip ${selectedCategory === cat ? "chip-active" : ""}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="input w-auto min-h-[38px] text-[13px] py-2"
          style={{ backgroundPosition: "calc(100% - 20px) 17px, calc(100% - 15px) 17px" }}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <p className="mt-6 mb-4">
        <span className="kicker kicker-muted num">
          {filteredIdeas.length} idea{filteredIdeas.length !== 1 && "s"} found
        </span>
      </p>

      {filteredIdeas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              isOwner={!!user && !!idea.userId && idea.userId === user.id}
              isPurchased={!!user && purchasedIds.has(idea.id)}
              onBuyClick={handleBuyClick}
            />
          ))}
        </div>
      ) : (
        <div className="panel-flat rounded-[30px] py-20 text-center">
          <p className="text-lg font-semibold text-neutral-800">No ideas match your search.</p>
          <p className="text-sm text-neutral-600 mt-1">Try adjusting your filters or search terms.</p>
        </div>
      )}

      {buyIdea && (
        <BuyConfirmModal
          idea={buyIdea}
          onClose={() => setBuyIdea(null)}
          onPurchased={handlePurchased}
        />
      )}
      {authPromptIdea && (
        <AuthPromptModal
          idea={authPromptIdea}
          onClose={() => setAuthPromptIdea(null)}
        />
      )}
    </div>
  );
}
