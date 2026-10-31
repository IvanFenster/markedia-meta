"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { type Idea } from "@/lib/mock-data";
import { formatScore, scoreOrbClass, scoreTone } from "@/lib/score-utils";
import { supabase } from "@/lib/supabase";
import { previewSummary, readPreviewParts } from "@/lib/preview";

const ArrowRight = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

// ─── Hero ───
function Hero() {
  return (
    <header className="max-w-[1200px] mx-auto px-8 pt-16 pb-10 grid gap-14 items-center lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
      <div>
        <span className="inline-flex items-center gap-2.5 pl-3 pr-4 py-[7px] rounded-full bg-surface elev-sm text-[13px] font-bold text-neutral-700">
          <span
            className="w-2 h-2 rounded-full bg-accent"
            style={{ boxShadow: "0 0 0 4px var(--color-accent-100)" }}
          />
          The market of ideas
        </span>

        <h1 className="mt-6 text-[clamp(46px,5.6vw,82px)]">
          Get an idea<br />
          for your <span className="text-accent">Startup.</span>
        </h1>

        <p className="max-w-[52ch] mt-7 text-[17.5px] leading-[1.6] text-neutral-700">
          Markedia connects <strong className="text-ink font-bold">Visioners</strong> who have
          groundbreaking ideas with <strong className="text-ink font-bold">Builders</strong>{" "}
          who can make them real. AI evaluates, scores, and previews every idea — so you know
          exactly what you&apos;re getting.
        </p>

        <div className="flex flex-wrap gap-3 items-center mt-8">
          <Link href="/market" className="btn btn-primary btn-lg">Browse ideas</Link>
          <Link href="/lab" className="btn btn-secondary btn-lg">
            Sell your idea
            <ArrowRight />
          </Link>
        </div>

        <p className="mt-4 text-[13.5px] text-neutral-600">
          Selling an idea? Everything starts in the Lab.
        </p>
      </div>

      {/* Collage */}
      <div className="relative pt-8 pb-12 hidden lg:block">
        <div
          className="absolute bg-accent-100"
          style={{
            inset: "0 -12px 18px 26px",
            borderRadius: "52% 48% 44% 56% / 48% 52% 48% 52%",
            transform: "rotate(-4deg)",
          }}
        />
        <div
          className="absolute right-3.5 top-0 w-[190px] h-[190px] rounded-full"
          style={{ background: "rgba(234,161,28,0.16)", filter: "blur(2px)" }}
        />

        <article
          className="relative max-w-[430px] ml-auto p-[26px] bg-surface elev-lg"
          style={{ borderRadius: "var(--radius-lg)", transform: "rotate(-1.4deg)" }}
        >
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <span className="kicker">Startup idea</span>
              <h3 className="mt-2.5 text-[23px]">
                A compliance layer that lets small clinics run remote trials
              </h3>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="score score-high">8.6</div>
              <span className="score-label">Score</span>
            </div>
          </div>

          <div className="ai-preview mt-[18px]">
            <span className="kicker">AI preview</span>
            <p className="mt-1.5 text-sm leading-[1.55]">
              A regulatory-workflow product for under-resourced clinical sites — the submission
              burden reframed as a template problem.
            </p>
          </div>

          <div className="mt-[18px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="avatar w-[30px] h-[30px]">ND</span>
              <span className="text-[13.5px] font-semibold text-neutral-700">Nadia Duarte</span>
            </div>
            <span className="price text-2xl">$340</span>
          </div>
        </article>

        <div
          className="relative z-[2] mt-4 inline-flex items-center gap-2.5 pl-3 pr-[18px] py-2.5 rounded-full bg-surface elev-md"
          style={{ transform: "rotate(2deg)" }}
        >
          <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-full bg-accent text-white shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3" /><path d="M12 18v3" /><path d="M4.9 4.9l2.1 2.1" /><path d="M17 17l2.1 2.1" />
              <path d="M3 12h3" /><path d="M18 12h3" /><path d="M4.9 19.1L7 17" /><path d="M17 7l2.1-2.1" />
            </svg>
          </span>
          <span className="text-[13.5px] font-bold">Scored on 7 criteria before it goes live</span>
        </div>
      </div>
    </header>
  );
}

// ─── Idea card (Top ideas) ───
function TopIdeaCard({ idea }: { idea: Idea }) {
  return (
    <article className="card card-lift p-6 flex flex-col shrink-0 w-[min(92vw,380px)] snap-start lg:w-auto">
      <div className="flex gap-3.5 items-start">
        <h4 className="flex-1 min-w-0 text-[20px]">
          <Link href={`/ideas/${idea.id}`} className="text-ink no-underline hover:text-accent-700 transition-colors">
            {idea.heading}
          </Link>
        </h4>
        <div className="flex flex-col items-center gap-1.5">
          <div className={scoreOrbClass(scoreTone(idea.overallScore))}>
            {formatScore(idea.overallScore)}
          </div>
          <span className="score-label">Score</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mt-4">
        <span className="avatar">{idea.author.avatar}</span>
        {idea.author.nickname ? (
          <Link href={`/u/${idea.author.nickname}`} className="text-[13.5px] font-semibold text-neutral-700 no-underline hover:text-ink transition-colors">
            {idea.author.name}
          </Link>
        ) : (
          <span className="text-[13.5px] font-semibold text-neutral-700">{idea.author.name}</span>
        )}
      </div>

      {idea.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3.5">
          {idea.categories.slice(0, 3).map((c) => (
            <span key={c} className="tag">{c}</span>
          ))}
        </div>
      )}

      <div className="ai-preview mt-4">
        <span className="kicker">AI preview</span>
        <p className="mt-1.5 text-sm leading-[1.55] line-clamp-5">{previewSummary(idea.aiPreviewParts, idea.aiPreview)}</p>
      </div>

      <div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <span className="price text-[26px]">${idea.price}</span>
          <span className="text-[12.5px] font-semibold text-neutral-600 num whitespace-nowrap">
            {idea.buyCount} bought
          </span>
        </div>
        <Link href={`/ideas/${idea.id}`} className="btn btn-primary btn-sm">Learn more</Link>
      </div>
    </article>
  );
}

// ─── Top ideas ───
function TopIdeas() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [topIdeas, setTopIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const ideasRes = await supabase
        .from("ideas")
        .select("*")
        .eq("status", "published")
        .order("overall_score", { ascending: false, nullsFirst: false })
        .limit(10);

      if (ideasRes.error) {
        console.error("[landing] failed to load top ideas:", ideasRes.error);
        setLoading(false);
        return;
      }
      // Secured ideas are off the market.
      const rows = (ideasRes.data ?? []).filter((r) => !r.is_exclusive);
      if (rows.length === 0) {
        setTopIdeas([]);
        setLoading(false);
        return;
      }

      const userIds = Array.from(new Set(rows.map((r) => r.user_id as string).filter(Boolean)));
      const profilesRes = userIds.length
        ? await supabase.from("profiles").select("id, display_name, avatar_initials, nickname").in("id", userIds)
        : { data: [], error: null };

      const profileMap = new Map<string, { display_name?: string; avatar_initials?: string; nickname?: string }>();
      (profilesRes.data ?? []).forEach((p) => {
        profileMap.set(p.id as string, {
          display_name: p.display_name as string | undefined,
          avatar_initials: p.avatar_initials as string | undefined,
          nickname: p.nickname as string | undefined,
        });
      });

      const mapped: Idea[] = rows.map((row: Record<string, unknown>) => {
        const profile = profileMap.get(row.user_id as string);
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
          scores: row.scores as Idea["scores"],
          aiPreview: (row.ai_preview as string) || "",
          aiPreviewParts: readPreviewParts(row.ai_preview_parts),
          price: (row.price as number) || 0,
          suggestedPrice: (row.suggested_price as number) || 0,
          exclusivityPrice: (row.exclusivity_price as number | null) ?? null,
          buyCount: (row.buy_count as number) || 0,
          createdAt: ((row.created_at as string) || "").split("T")[0],
          trending: false,
        };
      });
      setTopIdeas(mapped);
      setLoading(false);
    })();
  }, []);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.9), behavior: "smooth" });
  }, []);

  if (!loading && topIdeas.length === 0) return null;

  return (
    <section className="max-w-[1200px] mx-auto px-8 pt-14 pb-5">
      <div className="flex items-end justify-between gap-6 mb-7">
        <div>
          <span className="kicker">On the market</span>
          <h2 className="mt-2.5 text-[clamp(30px,3.4vw,42px)]">Top ideas, ready to build</h2>
        </div>
        {topIdeas.length > 3 && (
          <div className="hidden sm:flex gap-2 items-center">
            <button onClick={() => scrollBy(-1)} className="btn btn-secondary btn-icon" aria-label="Previous">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>
            </button>
            <button onClick={() => scrollBy(1)} className="btn btn-secondary btn-icon" aria-label="Next">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m10 6 6 6-6 6" /></svg>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-[380px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto snap-x pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible"
          style={{ scrollbarWidth: "none" }}
        >
          {topIdeas.slice(0, 9).map((idea) => (
            <TopIdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}

      <div className="flex justify-center mt-7">
        <Link href="/market" className="btn btn-secondary">
          See all ideas on the Market
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

// ─── Ideas Lab CTA ───
function IdeasLabCTA() {
  return (
    <section className="max-w-[1200px] mx-auto px-8 pt-[72px] pb-6">
      <div
        className="panel-dark relative overflow-hidden p-8 sm:p-14 grid gap-11 items-end lg:grid-cols-[minmax(0,1fr)_auto]"
        style={{ borderRadius: "38px" }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            right: "-90px",
            top: "-120px",
            width: "420px",
            height: "420px",
            borderRadius: "999px",
            background:
              "radial-gradient(circle at 42% 42%, rgba(232,93,31,0.5), rgba(232,93,31,0.18) 46%, rgba(232,93,31,0) 100%)",
            filter: "blur(18px)",
          }}
        />
        <div className="relative">
          <span className="text-xs font-bold uppercase tracking-[0.055em] text-accent-300">
            Have an idea worth sharing?
          </span>
          <h2 className="mt-4 text-[clamp(34px,4vw,56px)] text-[#fff8f2] max-w-[19ch]">
            Sell your idea at the Ideas Lab.
          </h2>
          <p className="mt-5 max-w-[60ch] text-[16.5px] leading-[1.65] text-[rgba(255,248,242,0.7)]">
            The Lab is your workspace for creating, evaluating, and publishing ideas. Document your
            concept, get an honest AI evaluation across seven criteria, and decide when — and at what
            price — to put it on the Market.
          </p>
        </div>
        <Link href="/lab" className="btn btn-primary btn-lg relative">
          Sell your idea
          <ArrowRight />
        </Link>
      </div>
    </section>
  );
}

// ─── How it works ───
const STEPS = [
  {
    n: "01",
    title: "Document your idea",
    body: "Write the problem, the solution, and why it matters. Nothing is public yet.",
  },
  {
    n: "02",
    title: "AI evaluates & previews",
    body: "Six criteria are scored and weighted, then a preview is written that describes the idea without giving it away.",
  },
  {
    n: "03",
    title: "Set price & publish",
    body: "AI suggests a price; you choose it. Your idea goes live on the Market.",
  },
  {
    n: "04",
    title: "Builders discover & buy",
    body: "Browse, filter, or describe what you need. Buy the full idea and start building.",
  },
];

// The diagonal: each card sits lower than the last, and the payoff card is solid accent.
const STAGGER = ["lg:mt-0", "lg:mt-[22px]", "lg:mt-[44px]", "lg:mt-[66px]"];

function HowItWorks() {
  return (
    <section className="max-w-[1200px] mx-auto px-8 pt-14 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-7">
        <div>
          <span className="kicker">How it works</span>
          <h2 className="mt-2.5 text-[clamp(30px,3.4vw,42px)]">From idea to impact, in four steps</h2>
        </div>
        <p className="max-w-[32ch] text-[14.5px] leading-[1.6] text-neutral-600">
          The same pipeline whether you&apos;re selling a startup concept or a research question.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 items-start">
        {STEPS.map((s, i) => {
          const isLast = i === STEPS.length - 1;
          return (
            <div
              key={s.n}
              className={`p-[26px] ${STAGGER[i]} ${isLast ? "" : "bg-surface elev-sm"}`}
              style={{
                borderRadius: "26px",
                ...(isLast
                  ? {
                      background: "var(--color-accent)",
                      boxShadow: "0 18px 40px -22px rgba(200,70,20,0.75)",
                    }
                  : {}),
              }}
            >
              <span
                className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-full font-heading font-bold text-[15px] num"
                style={
                  isLast
                    ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
                    : { background: "var(--color-accent-100)", color: "var(--color-accent-700)" }
                }
              >
                {s.n}
              </span>
              <h4 className={`mt-[18px] mb-2.5 text-[19px] ${isLast ? "text-white" : ""}`}>
                {s.title}
              </h4>
              <p
                className={`text-sm leading-[1.6] ${isLast ? "" : "text-neutral-700"}`}
                style={isLast ? { color: "rgba(255,255,255,0.86)" } : undefined}
              >
                {s.body}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <TopIdeas />
      <IdeasLabCTA />
      <HowItWorks />
    </>
  );
}
