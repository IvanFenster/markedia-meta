"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { loadIdeaDetailsMany } from "@/lib/idea-details";
import { previewSummary, readPreviewParts } from "@/lib/preview";
import { formatScore, scoreOrbClass, scoreTone } from "@/lib/score-utils";
import { type IdeaScore } from "@/lib/mock-data";
import AuthForm from "@/components/auth-form";

// ─── Types ───
interface DbIdea {
  id: string;
  heading: string;
  idea_type: string;
  categories: string[];
  form_data: Record<string, unknown>;
  scores: IdeaScore | null;
  reasonings: Record<string, string> | null;
  overall_score: number | null;
  ai_preview: string | null;
  ai_preview_parts?: unknown;
  price: number | null;
  suggested_price: number | null;
  buy_count: number;
  status: string;
  created_at: string;
}

interface DbPurchase {
  id: string;
  price_paid: number;
  created_at: string;
  ideas: DbIdea;
}

interface DbSaved {
  id: string;
  created_at: string;
  ideas: DbIdea;
}

// ─── Saved idea card (links out to the public idea page) ───
function SavedCard({ idea, onUnsave }: { idea: DbIdea; onUnsave: () => void }) {
  return (
    <div className="relative bg-white rounded-xl border border-neutral-300 hover:border-accent-300 hover:shadow-md transition-all flex flex-col">
      <Link href={`/ideas/${idea.id}`} className="block p-5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-ink leading-snug line-clamp-2 pr-10">{idea.heading}</h3>
          {idea.overall_score != null && (
            <div className={scoreOrbClass(scoreTone(idea.overall_score), "sm")}>
              {formatScore(idea.overall_score)}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {idea.categories?.slice(0, 3).map((c) => (
            <span key={c} className="bg-neutral-200 text-neutral-600 text-xs px-2 py-0.5 rounded-full">{c}</span>
          ))}
        </div>
        {idea.ai_preview && <p className="text-sm text-neutral-600 line-clamp-2 leading-relaxed mt-2">{previewSummary(readPreviewParts(idea.ai_preview_parts), idea.ai_preview)}</p>}
        <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-neutral-200">
          <span className="text-lg font-bold text-ink">${idea.price ?? 0}</span>
          <span className="text-xs text-accent-700 font-medium">Review & decide →</span>
        </div>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnsave(); }}
        className="absolute top-3 right-3 w-7 h-7 bg-accent-100 text-accent-700 hover:bg-accent-200 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        title="Remove from Saved"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
        </svg>
      </button>
    </div>
  );
}

// ─── Purchased idea card (opens the full "bought idea" page) ───
function PurchasedCard({ idea }: { idea: DbIdea }) {
  // Once bought, show the seller's original heading (the AI heading was only the
  // public/market title).
  const originalHeading = String((idea.form_data as Record<string, unknown>)?.originalHeading || idea.heading);
  return (
    <div className="relative">
      <Link
        href={`/purchased/${idea.id}`}
        className="w-full text-left bg-white rounded-xl border border-neutral-300 hover:border-positive hover:shadow-md transition-all p-5 flex flex-col gap-3 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-ink leading-snug line-clamp-2 pr-12">{originalHeading}</h3>
          {idea.overall_score != null && (
            <div className={scoreOrbClass(scoreTone(idea.overall_score), "sm")}>
              {formatScore(idea.overall_score)}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {idea.categories?.slice(0, 3).map((c) => (
            <span key={c} className="bg-neutral-200 text-neutral-600 text-xs px-2 py-0.5 rounded-full">{c}</span>
          ))}
        </div>
        {idea.ai_preview && <p className="text-sm text-neutral-600 line-clamp-2 leading-relaxed">{previewSummary(readPreviewParts(idea.ai_preview_parts), idea.ai_preview)}</p>}
        <span className="text-xs text-positive-700 font-medium mt-1">Open full idea &amp; give feedback →</span>
      </Link>
      <div className="absolute top-3 right-3 bg-positive text-white text-[10px] font-bold px-2 py-0.5 rounded-full">OWNED</div>
    </div>
  );
}

// ─── Main account page ───
export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}

function AccountContent() {
  const { user, session, loading } = useAuth();
  const searchParams = useSearchParams();
  const defaultMode = searchParams.get("mode") === "signup" ? "signup" : "login";

  const [purchases, setPurchases] = useState<DbPurchase[]>([]);
  const [savedIdeas, setSavedIdeas] = useState<DbSaved[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);

  // Load the user's public handle (for the "view public profile" link).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) { if (!cancelled) setNickname(null); return; }
      const { data } = await supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle();
      if (!cancelled) setNickname((data?.nickname as string) || null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Confirm admin status server-side so the link only appears for real admins.
  useEffect(() => {
    const token = session?.access_token;
    let cancelled = false;
    void (async () => {
      if (!token) { if (!cancelled) setIsAdmin(false); return; }
      try {
        const res = await fetch("/api/admin/check", { headers: { Authorization: `Bearer ${token}` } });
        const j = await res.json().catch(() => ({ admin: false }));
        if (!cancelled) setIsAdmin(!!j.admin);
      } catch { if (!cancelled) setIsAdmin(false); }
    })();
    return () => { cancelled = true; };
  }, [session?.access_token]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);

    const [ideasRes, purchasesRes, savedRes] = await Promise.all([
      // Just need the count for the header — not the rows
      supabase.from("ideas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "published"),
      supabase.from("purchases")
        .select("*, ideas(*)")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("saved_ideas")
        .select("id, created_at, ideas(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (ideasRes.error) console.error("[account] failed to count published:", ideasRes.error);
    if (purchasesRes.error) console.error("[account] failed to load purchases:", purchasesRes.error);
    if (savedRes.error) console.error("[account] failed to load saved ideas:", savedRes.error);

    setPublishedCount(ideasRes.count ?? 0);
    if (purchasesRes.data) {
      const rows = purchasesRes.data as unknown as DbPurchase[];
      // Purchased ideas carry their paid content in idea_details; the card uses
      // the author's original heading from there.
      const details = await loadIdeaDetailsMany(rows.map((r) => r.ideas?.id).filter(Boolean));
      for (const r of rows) {
        const d = r.ideas && details.get(r.ideas.id);
        if (d) Object.assign(r.ideas, d);
      }
      setPurchases(rows);
    }
    if (savedRes.data) {
      // Filter out any saves whose target idea was deleted / unpublished so RLS returns null.
      const rows = (savedRes.data as unknown as DbSaved[]).filter((r) => r.ideas);
      setSavedIdeas(rows);
    }
    setDataLoading(false);
  }, [user]);

  const handleUnsave = async (savedId: string) => {
    if (!user) return;
    const prev = savedIdeas;
    setSavedIdeas((s) => s.filter((r) => r.id !== savedId));
    const { error } = await supabase.from("saved_ideas").delete().eq("id", savedId);
    if (error) {
      console.error("[account] unsave failed:", error);
      setSavedIdeas(prev);
    }
  };

  useEffect(() => {
    if (!user) return;
    void (async () => { await fetchData(); })();
  }, [user, fetchData]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-100 text-accent-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink">Welcome to Markedia</h1>
          <p className="text-neutral-600 mt-1">Sign up or log in to manage your ideas</p>
        </div>
        <AuthForm defaultMode={defaultMode as "login" | "signup"} />
      </div>
    );
  }

  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Profile header */}
      <div className="card p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent-200 text-accent-800 text-lg font-bold flex items-center justify-center">{initials}</div>
          <div>
            <h1 className="text-xl font-bold text-ink">{displayName}</h1>
            <p className="text-sm text-neutral-600">{user.email}</p>
            {nickname && (
              <Link href={`/u/${nickname}`} className="text-xs text-accent-700 font-medium hover:underline mt-0.5 inline-block">
                @{nickname} · View public profile →
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-ink">{publishedCount}</p>
            <p className="text-xs text-neutral-500 uppercase">Published</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ink">{purchases.length}</p>
            <p className="text-xs text-neutral-500 uppercase">Purchased</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ink">{savedIdeas.length}</p>
            <p className="text-xs text-neutral-500 uppercase">Saved</p>
          </div>
        </div>
      </div>

      {/* Admin Panel link — only rendered for confirmed admins */}
      {isAdmin && (
        <Link
          href="/admin"
          className="btn btn-dark justify-between mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Restricted</p>
              <h2 className="text-lg font-bold">Admin Panel</h2>
            </div>
          </div>
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      )}

      {/* Big Ideas Lab CTA */}
      <Link
        href="/lab"
        className="block bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-3xl p-6 sm:p-8 text-white mb-10 shadow-md transition-all group"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-accent-100 text-xs font-semibold uppercase tracking-widest mb-1">Your workspace</p>
            <h2 className="text-2xl font-bold">Ideas Lab</h2>
            <p className="text-accent-100 text-sm mt-1">
              Create, evaluate, edit, and publish your ideas — all in one place.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 group-hover:bg-white/20 transition-colors px-4 py-2.5 rounded-xl shrink-0">
            <span className="text-sm font-medium">Open Lab</span>
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Purchased section */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-ink mb-4">
          Ideas You Bought <span className="text-sm font-normal text-neutral-500 ml-2">{purchases.length}</span>
        </h2>
        {dataLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : purchases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {purchases.map((p) => (
              <PurchasedCard key={p.id} idea={p.ideas} />
            ))}
          </div>
        ) : (
          <div className="bg-neutral-100 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
            <p className="text-neutral-500 text-sm">You haven&apos;t bought any ideas yet</p>
            <Link href="/market" className="text-accent hover:text-accent-700 text-sm font-medium mt-1 inline-block">
              Browse the Market
            </Link>
          </div>
        )}
      </div>

      {/* Saved section */}
      <div>
        <h2 className="text-lg font-bold text-ink mb-1">
          Saved for Later <span className="text-sm font-normal text-neutral-500 ml-2">{savedIdeas.length}</span>
        </h2>
        <p className="text-sm text-neutral-600 mb-4">
          Ideas you&apos;re still deciding on. Click to re-read the preview and scores.
        </p>
        {dataLoading ? (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : savedIdeas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedIdeas.map((s) => (
              <SavedCard
                key={s.id}
                idea={s.ideas}
                onUnsave={() => handleUnsave(s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-neutral-100 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
            <p className="text-neutral-500 text-sm">Nothing saved yet</p>
            <p className="text-xs text-neutral-500 mt-1">
              On the Market, use <strong>Save for later</strong> on any idea to come back to it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
