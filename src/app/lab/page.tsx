"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { previewSummary, readPreviewParts } from "@/lib/preview";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  SORT_LABELS,
  sortIdeas,
  type DbIdea,
  type SortKey,
} from "@/lib/idea-helpers";
import { formatScore, scoreOrbClass, scoreTone } from "@/lib/score-utils";
import AuthForm from "@/components/auth-form";

// ─── Idea card (used in main grid + drafts strip) ───
function LabIdeaCard({ idea }: { idea: DbIdea }) {
  return (
    <Link
      href={`/lab/${idea.id}`}
      className="block bg-white rounded-xl border border-neutral-300 hover:border-accent-300 hover:shadow-md transition-all p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[idea.status]}`}
          >
            {STATUS_LABEL[idea.status]}
          </span>
          <h3 className="text-sm font-semibold text-ink leading-snug mt-1.5 line-clamp-2">
            {idea.heading || <span className="text-neutral-500 italic">Untitled</span>}
          </h3>
        </div>
        {idea.overall_score != null ? (
          <div className={scoreOrbClass(scoreTone(idea.overall_score), "sm")}>
            {formatScore(idea.overall_score)}
          </div>
        ) : (
          <div className="w-11 h-11 rounded-lg bg-neutral-200 text-neutral-500 flex items-center justify-center text-[10px] font-medium shrink-0">
            N/A
          </div>
        )}
      </div>

      {idea.categories && idea.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {idea.categories.slice(0, 3).map((c) => (
            <span key={c} className="bg-neutral-200 text-neutral-600 text-[10px] px-1.5 py-0.5 rounded-full">{c}</span>
          ))}
        </div>
      )}

      {idea.ai_preview && (
        <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">{previewSummary(readPreviewParts(idea.ai_preview_parts), idea.ai_preview)}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-200">
        <span className="text-xs text-neutral-500">{new Date(idea.created_at).toLocaleDateString()}</span>
        {idea.price != null ? (
          <span className="text-sm font-bold text-ink">${idea.price}</span>
        ) : (
          <span className="text-xs text-neutral-500">{idea.buy_count > 0 ? `${idea.buy_count} bought` : "—"}</span>
        )}
      </div>
    </Link>
  );
}

// ─── Filter chips for status ───
type StatusFilter = "all" | "published" | "unpublished";

function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
        active
          ? "bg-ink text-white shadow-sm"
          : "bg-white text-neutral-700 border border-neutral-300 hover:border-gray-400"
      }`}
    >
      {children} <span className={`ml-1 ${active ? "text-neutral-400" : "text-neutral-500"}`}>({count})</span>
    </button>
  );
}

// ─── Main Lab Page ───
export default function LabPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [ideas, setIdeas] = useState<DbIdea[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [showArchive, setShowArchive] = useState(false);

  const fetchIdeas = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const { data, error } = await supabase
      .from("ideas")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[lab] failed to load ideas:", error);
    } else if (data) {
      setIdeas(data as DbIdea[]);
    }
    setDataLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void (async () => { await fetchIdeas(); })();
  }, [user, fetchIdeas]);

  const drafts = useMemo(() => ideas.filter((i) => i.status === "draft"), [ideas]);
  const archived = useMemo(() => ideas.filter((i) => i.status === "archived"), [ideas]);

  // "Your Ideas" pool: everything except drafts + archived
  const created = useMemo(
    () => ideas.filter((i) => i.status === "published" || i.status === "unpublished"),
    [ideas]
  );

  const filtered = useMemo(() => {
    let list = created;
    if (statusFilter === "published") list = list.filter((i) => i.status === "published");
    else if (statusFilter === "unpublished") list = list.filter((i) => i.status === "unpublished");
    return sortIdeas(list, sortKey);
  }, [created, statusFilter, sortKey]);

  const publishedCount = created.filter((i) => i.status === "published").length;
  const unpublishedCount = created.filter((i) => i.status === "unpublished").length;

  // ─── Auth gate ───
  if (authLoading) {
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink">Welcome to the Ideas Lab</h1>
          <p className="text-neutral-600 mt-1">Sign in to start creating and publishing ideas</p>
        </div>
        <AuthForm defaultMode="signup" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* ─── Hero ─── */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-8 sm:p-12 text-white mb-10 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-accent-100 text-sm font-medium uppercase tracking-widest mb-2">
              Your workspace
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              Ideas Lab
            </h1>
            <p className="text-accent-100 text-base sm:text-lg mt-2 max-w-xl">
              Document, evaluate, and publish your ideas — all in one place.
            </p>
          </div>
          <button
            onClick={() => router.push("/lab/new")}
            className="bg-white text-accent-700 hover:bg-accent-100 font-semibold px-6 py-3.5 rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create New Idea
          </button>
        </div>
      </div>

      {dataLoading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* ─── Drafts strip ─── */}
          {drafts.length > 0 && (
            <section className="mb-10">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">Pick up where you left off</h2>
                  <p className="text-sm text-neutral-600 mt-0.5">
                    {drafts.length} draft{drafts.length === 1 ? "" : "s"} — finish them or convert to a full idea.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {drafts.map((d) => (
                  <LabIdeaCard key={d.id} idea={d} />
                ))}
              </div>
            </section>
          )}

          {/* ─── Your Ideas ─── */}
          <section className="mb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-ink">
                Your Ideas
                <span className="text-sm font-normal text-neutral-500 ml-2">{created.length}</span>
              </h2>

              {created.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="text-xs border border-neutral-300 rounded-lg px-3 py-1.5 bg-white text-neutral-800 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 outline-none cursor-pointer"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <option key={k} value={k}>{SORT_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {created.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")} count={created.length}>
                  All
                </FilterChip>
                <FilterChip active={statusFilter === "published"} onClick={() => setStatusFilter("published")} count={publishedCount}>
                  Published
                </FilterChip>
                <FilterChip active={statusFilter === "unpublished"} onClick={() => setStatusFilter("unpublished")} count={unpublishedCount}>
                  Unpublished
                </FilterChip>
              </div>
            )}

            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((idea) => (
                  <LabIdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            ) : created.length === 0 ? (
              <div className="bg-neutral-100 border border-dashed border-neutral-300 rounded-2xl p-10 text-center">
                <div className="w-12 h-12 bg-accent-100 text-accent rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-800">No ideas yet</p>
                <p className="text-xs text-neutral-600 mt-1 mb-4">Create your first idea to get started.</p>
                <Link
                  href="/lab/new"
                  className="btn btn-primary"
                >
                  Create New Idea
                </Link>
              </div>
            ) : (
              <div className="bg-neutral-100 border border-dashed border-neutral-300 rounded-xl p-6 text-center">
                <p className="text-sm text-neutral-600">No ideas match the current filter.</p>
              </div>
            )}
          </section>

          {/* ─── Archive (collapsed) ─── */}
          <section className="border-t border-neutral-300 pt-8">
            <button
              onClick={() => setShowArchive(!showArchive)}
              className="flex items-center justify-between w-full text-left group cursor-pointer"
            >
              <div>
                <h2 className="text-lg font-bold text-ink group-hover:text-accent-700 transition-colors">
                  Archive
                  <span className="text-sm font-normal text-neutral-500 ml-2">{archived.length}</span>
                </h2>
                <p className="text-sm text-neutral-600 mt-0.5">
                  Ideas you&apos;ve set aside. Restore any time.
                </p>
              </div>
              <svg
                className={`w-5 h-5 text-neutral-500 transition-transform ${showArchive ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showArchive && (
              <div className="mt-5">
                {archived.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archived.map((idea) => (
                      <LabIdeaCard key={idea.id} idea={idea} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-neutral-100 border border-dashed border-neutral-300 rounded-xl p-6 text-center">
                    <p className="text-sm text-neutral-600">Your archive is empty.</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
