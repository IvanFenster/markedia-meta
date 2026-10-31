"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { previewSummary, readPreviewParts } from "@/lib/preview";
import { formatScore, scoreOrbClass, scoreTone } from "@/lib/score-utils";

interface PublicProfile {
  id: string;
  display_name: string | null;
  avatar_initials: string | null;
  nickname: string | null;
  created_at: string;
}

interface ListedIdea {
  id: string;
  heading: string;
  categories: string[] | null;
  overall_score: number | null;
  ai_preview: string | null;
  ai_preview_parts?: unknown;
  price: number | null;
  buy_count: number;
  is_exclusive?: boolean;
}

export default function PublicProfilePage({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = use(params);
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [ideas, setIdeas] = useState<ListedIdea[]>([]);
  const [stats, setStats] = useState<{ sold: number; bought: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const profRes = await supabase
      .from("profiles")
      .select("id, display_name, avatar_initials, nickname, created_at")
      .ilike("nickname", nickname)
      .maybeSingle();

    const prof = profRes.data as PublicProfile | null;
    if (!prof) { setNotFound(true); setLoading(false); return; }
    setProfile(prof);

    const [ideasRes, statsRes] = await Promise.all([
      supabase
        .from("ideas")
        .select("*")
        .eq("user_id", prof.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase.rpc("public_profile_stats", { p_user_id: prof.id }),
    ]);

    if (ideasRes.data) setIdeas((ideasRes.data as ListedIdea[]).filter((i) => !i.is_exclusive));
    const srow = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
    setStats({ sold: Number(srow?.sold_count) || 0, bought: Number(srow?.bought_count) || 0 });
    setNotFound(false);
    setLoading(false);
  }, [nickname]);

  const isOwner = !!user && !!profile && profile.id === user.id;

  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink mb-2">Profile not found</h1>
        <p className="text-neutral-600 mb-6">There&apos;s no author with the handle @{nickname}.</p>
        <Link href="/market" className="btn btn-primary">Back to Market</Link>
      </div>
    );
  }

  const displayName = profile.display_name || "Unknown";
  const initials = profile.avatar_initials || displayName.slice(0, 2).toUpperCase();
  const memberSince = profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" }) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Owner banner — this is the public view; offer a way back to private account */}
      {isOwner && (
        <div className="mb-6 bg-accent-100 border border-accent-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-accent-800">
            This is your <span className="font-semibold">public profile</span> — how other users see you.
          </p>
          <Link
            href="/account"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-white border border-accent-300 hover:border-accent-400 text-accent-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Back to your account
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      )}

      {/* Profile header */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent-200 text-accent-800 text-xl font-bold flex items-center justify-center shrink-0">{initials}</div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink truncate">{displayName}</h1>
            <p className="text-sm text-accent-700 font-medium">@{profile.nickname}</p>
            {memberSince && <p className="text-xs text-neutral-500 mt-0.5">Member since {memberSince}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="text-center bg-neutral-100 rounded-xl py-3">
            <p className="text-2xl font-bold text-ink">{ideas.length}</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wide">For sale</p>
          </div>
          <div className="text-center bg-neutral-100 rounded-xl py-3">
            <p className="text-2xl font-bold text-ink">{stats?.sold ?? 0}</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wide">Sold</p>
          </div>
          <div className="text-center bg-neutral-100 rounded-xl py-3">
            <p className="text-2xl font-bold text-ink">{stats?.bought ?? 0}</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wide">Bought</p>
          </div>
        </div>
        {/* Rating placeholder — coming later */}
        <p className="text-[11px] text-neutral-400 text-center mt-3">Author rating coming soon</p>
      </div>

      {/* Ideas for sale */}
      <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">
        Ideas for sale <span className="text-neutral-500 font-normal ml-1">{ideas.length}</span>
      </h2>
      {ideas.length === 0 ? (
        <div className="bg-neutral-100 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-neutral-500 text-sm">{displayName} has no ideas listed on the Market right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ideas.map((idea) => (
            <Link key={idea.id} href={`/ideas/${idea.id}`} className="block bg-white rounded-xl border border-neutral-300 hover:border-accent-300 hover:shadow-md transition-all p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-ink leading-snug line-clamp-2 pr-2">{idea.heading}</h3>
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
                <span className="text-xs text-neutral-500">{idea.buy_count} bought</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
