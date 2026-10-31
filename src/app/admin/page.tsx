"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { formatScore, formatSubScore, scoreOrbClass, scoreTone, scoreToneColor, subScoreTone } from "@/lib/score-utils";
import { SCORE_LABELS, criterionWeight, scoredCriteria, type IdeaScore } from "@/lib/mock-data";

const POLL_MS = 15000;

const ACCURACY_LABELS: Record<string, string> = {
  "-2": "Completely under", "-1": "Slightly under", "0": "Accurate", "1": "Slightly over", "2": "Completely over",
};

// ─── Loose response types ───
interface EvalStep { step: number; name: string; model?: string; ok?: boolean; durationMs?: number; input?: string; output?: string; error?: string; finishReason?: string; usage?: Record<string, number>; searchQueryCount?: number; webSearchQueries?: string[]; httpStatus?: number; attempts?: number }
interface EvalLog { evalId: string; startedAt: string; totalDurationMs: number; ok: boolean; error?: string | null; models?: { research?: string; scoring?: string; heading?: string }; totals?: Record<string, number>; steps?: EvalStep[]; output?: Record<string, unknown> }
interface AdminIdea { idea: Record<string, unknown>; evaluations: EvalLog[]; purchaseCount: number; revenue: number }
interface Overview {
  generatedAt: string;
  you: { email: string };
  admins: string[];
  stats: {
    users: { total: number; admins: number };
    ideas: { total: number; byStatus: Record<string, number>; byType: Record<string, number>; avgPublishedScore: number | null; top: Array<Record<string, unknown>> };
    purchases: { total: number; revenue: number; recent: Array<Record<string, unknown>> };
    saved: { total: number; available: boolean };
    feedback: { total: number; available: boolean; avgAccuracy: number | null; avgUserRating: number | null; accuracyDist: Record<string, number> };
    evaluations: { total: number; ok: number; avgDurationMs: number; modelTokens: number; reasoningTokens: number; totalTokens: number; searchQueries: number; estTokenCostUsd: number };
  };
  adminIdeas: AdminIdea[];
}

const num = (n: number) => n.toLocaleString("en-US");
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-ink mt-0.5">{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StepBlock({ s }: { s: EvalStep }) {
  const tokenStr = s.usage?.totalTokens != null ? `${num(s.usage.totalTokens)} tok` : null;
  return (
    <details className="bg-neutral-100 border border-neutral-300 rounded-lg">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-800 flex flex-wrap items-center gap-2">
        <span className="font-semibold">Step {s.step}: {s.name}</span>
        <span className={`px-1.5 py-0.5 rounded ${s.ok ? "bg-positive-100 text-positive-700" : "bg-danger-100 text-danger"}`}>
          {s.ok ? "ok" : "failed"}
        </span>
        {s.model && <span className="text-neutral-500">{s.model}</span>}
        {s.durationMs != null && <span className="text-neutral-500">{secs(s.durationMs)}</span>}
        {tokenStr && <span className="text-neutral-500">{tokenStr}</span>}
        {s.searchQueryCount != null && <span className="text-neutral-500">{s.searchQueryCount} queries</span>}
        {s.finishReason && <span className="text-neutral-500">finish: {s.finishReason}</span>}
      </summary>
      <div className="px-3 pb-3 space-y-2">
        {s.webSearchQueries && s.webSearchQueries.length > 0 && (
          <div>
            <p className="text-[10px] uppercase text-neutral-500 mb-1">Web searches</p>
            <ul className="list-disc list-inside text-xs text-neutral-700 space-y-0.5">
              {s.webSearchQueries.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}
        {s.error && <p className="text-xs text-danger whitespace-pre-wrap">Error: {s.error}</p>}
        {s.output && (
          <div>
            <p className="text-[10px] uppercase text-neutral-500 mb-1">Model output</p>
            <pre className="text-[11px] text-neutral-800 bg-white border border-neutral-300 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-80">{s.output}</pre>
          </div>
        )}
      </div>
    </details>
  );
}

function AdminIdeaCard({ entry }: { entry: AdminIdea }) {
  const idea = entry.idea;
  const scores = idea.scores as IdeaScore | null;
  const reasonings = (idea.reasonings as Record<string, string> | null) || null;
  const overall = idea.overall_score as number | null;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium text-accent-700 uppercase">{String(idea.idea_type)}</span>
            <span className="text-[10px] font-semibold uppercase text-neutral-600 bg-neutral-200 px-1.5 py-0.5 rounded">{String(idea.status)}</span>
          </div>
          <h3 className="text-base font-bold text-ink leading-snug">{String(idea.heading)}</h3>
          <p className="text-xs text-neutral-500 mt-1">
            ${String(idea.price ?? "—")} listed · AI suggested ${String(idea.suggested_price ?? "—")} · {entry.purchaseCount} bought · {money(entry.revenue)} revenue
          </p>
        </div>
        {overall != null && (
          <div className={scoreOrbClass(scoreTone(overall), "sm")}>
            {formatScore(overall)}
          </div>
        )}
      </div>

      {/* Scores + reasoning */}
      {scores && (
        <div className="mt-4 grid sm:grid-cols-2 gap-2">
          {scoredCriteria(scores).map((k) => (
            <div key={k} className="bg-neutral-100 border border-neutral-200 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-neutral-800">{SCORE_LABELS[k]} <span className="text-neutral-500 font-normal">{criterionWeight(k)}% weight</span></span>
                <span className="font-heading font-bold text-[15px] num" style={{ color: scoreToneColor(subScoreTone(scores[k])) }}>{formatSubScore(scores[k] as number)}</span>
              </div>
              {reasonings?.[k] && <p className="text-[11px] text-neutral-600 leading-relaxed">{reasonings[k]}</p>}
            </div>
          ))}
        </div>
      )}

      {idea.ai_preview != null && (
        <div className="mt-3 bg-accent-100 border border-accent-200 rounded-lg p-3">
          <p className="text-[10px] uppercase text-accent-700 mb-1">AI preview</p>
          <p className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap">{String(idea.ai_preview)}</p>
        </div>
      )}

      {/* Raw evaluation runs */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-neutral-800 mb-2">
          Evaluation runs <span className="text-neutral-500 font-normal">({entry.evaluations.length})</span>
        </p>
        {entry.evaluations.length === 0 ? (
          <p className="text-xs text-neutral-500">No raw evaluation logs matched this idea.</p>
        ) : (
          <div className="space-y-3">
            {entry.evaluations.map((ev) => (
              <div key={ev.evalId} className="border border-neutral-300 rounded-xl p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600 mb-2">
                  <span className="font-mono text-neutral-500">{ev.evalId.slice(0, 8)}</span>
                  <span>{new Date(ev.startedAt).toLocaleString()}</span>
                  <span className={ev.ok ? "text-positive-700" : "text-danger"}>{ev.ok ? "success" : "failed"}</span>
                  <span>{secs(ev.totalDurationMs)}</span>
                  {ev.totals && (
                    <>
                      <span>{num(ev.totals.totalTokens || (ev.totals.geminiTotalTokens || 0) + (ev.totals.deepseekTotalTokens || 0))} tokens</span>
                      <span>{ev.totals.searchQueries || 0} searches</span>
                    </>
                  )}
                  {ev.models?.scoring && <span className="text-neutral-500">{ev.models.scoring}</span>}
                </div>
                <div className="space-y-2">
                  {(ev.steps || []).map((s, i) => <StepBlock key={i} s={s} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const [data, setData] = useState<Overview | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "unauthorized" | "unconfigured" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOverview = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setStatus((s) => (s === "ok" ? "ok" : "loading"));
    try {
      const res = await fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403 || res.status === 401) { setStatus("unauthorized"); return; }
      if (res.status === 503) {
        const j = await res.json().catch(() => ({}));
        setErrMsg(j.error || "Admin backend not configured."); setStatus("unconfigured"); return;
      }
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErrMsg(j.error || `Error ${res.status}`); setStatus("error"); return; }
      const j = (await res.json()) as Overview;
      setData(j); setStatus("ok"); setLastUpdated(new Date());
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Network error"); setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void (async () => {
      if (!token) { if (!cancelled) setStatus("unauthorized"); return; }
      await fetchOverview();
    })();
    return () => { cancelled = true; };
  }, [authLoading, token, fetchOverview]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh && status === "ok" && token) {
      intervalRef.current = setInterval(() => void fetchOverview(true), POLL_MS);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, status, token, fetchOverview]);

  if (authLoading || (status === "loading" && !data)) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (status === "unauthorized") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink mb-2">Restricted area</h1>
        <p className="text-neutral-600 mb-6">This page is only available to Markedia administrators.</p>
        <Link href="/" className="btn btn-primary">Back home</Link>
      </div>
    );
  }

  if (status === "unconfigured") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink mb-2">Admin backend not configured</h1>
        <p className="text-neutral-600 mb-2">{errMsg}</p>
        <p className="text-sm text-neutral-500">Add <code className="bg-neutral-200 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to <code className="bg-neutral-200 px-1 rounded">.env.local</code> and restart the dev server.</p>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink mb-2">Couldn&apos;t load the dashboard</h1>
        <p className="text-neutral-600 mb-6">{errMsg}</p>
        <button onClick={() => void fetchOverview()} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  const s = data.stats;
  const evalSuccessRate = s.evaluations.total ? Math.round((s.evaluations.ok / s.evaluations.total) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Admin Panel</h1>
          <p className="text-sm text-neutral-600">Signed in as {data.you.email} · {data.admins.length} admin{data.admins.length !== 1 && "s"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ""}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-amber-500" />
            Auto-refresh
          </label>
          <button onClick={() => void fetchOverview()} className="btn btn-secondary">Refresh</button>
        </div>
      </div>

      {/* Platform stats */}
      <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">Platform statistics</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Users" value={num(s.users.total)} sub={`${s.users.admins} admin`} />
        <StatCard label="Ideas total" value={num(s.ideas.total)} sub={`${s.ideas.byStatus.published || 0} published`} />
        <StatCard label="Purchases" value={num(s.purchases.total)} />
        <StatCard label="Revenue" value={money(s.purchases.revenue)} />
        <StatCard label="Saved (wishlist)" value={s.saved.available ? num(s.saved.total) : "—"} sub={s.saved.available ? undefined : "table missing"} />
        <StatCard label="Feedback responses" value={s.feedback.available ? num(s.feedback.total) : "—"} sub={s.feedback.available ? undefined : "table missing"} />
        <StatCard label="Avg published score" value={s.ideas.avgPublishedScore != null ? formatScore(s.ideas.avgPublishedScore) : "—"} sub="/ 10" />
        <StatCard label="Avg buyer rating" value={s.feedback.avgUserRating != null ? s.feedback.avgUserRating.toFixed(1) : "—"} sub="/ 10" />
      </div>

      {/* Idea status / type breakdown */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs font-semibold text-neutral-800 mb-3">Ideas by status</p>
          <div className="space-y-1.5">
            {Object.entries(s.ideas.byStatus).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 capitalize">{k}</span>
                <span className="font-semibold text-neutral-900">{num(v)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-neutral-800 mt-4 mb-2">By type</p>
          <div className="space-y-1.5">
            {Object.entries(s.ideas.byType).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 capitalize">{k}</span>
                <span className="font-semibold text-neutral-900">{num(v)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-neutral-800 mb-3">Top published ideas</p>
          {s.ideas.top.length === 0 ? <p className="text-sm text-neutral-500">None yet.</p> : (
            <div className="space-y-2">
              {s.ideas.top.map((i) => (
                <div key={String(i.id)} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-neutral-800 truncate">{String(i.heading)}</span>
                  <span className="text-neutral-500 shrink-0">{num(Number(i.buy_count) || 0)} bought</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI evaluation stats */}
      <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">AI evaluation usage</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
        <StatCard label="Evaluations" value={num(s.evaluations.total)} sub={`${evalSuccessRate}% success`} />
        <StatCard label="Total tokens" value={num(s.evaluations.totalTokens)} sub={`${num(s.evaluations.reasoningTokens)} reasoning`} />
        <StatCard label="Web searches" value={num(s.evaluations.searchQueries)} />
        <StatCard label="Est. token cost" value={money(s.evaluations.estTokenCostUsd)} sub="excl. grounding fees" />
        <StatCard label="Model tokens" value={num(s.evaluations.modelTokens)} />
        <StatCard label="Avg duration" value={secs(s.evaluations.avgDurationMs)} />
        <StatCard label="Accuracy (avg)" value={s.feedback.avgAccuracy != null ? s.feedback.avgAccuracy.toFixed(2) : "—"} sub="−2 under … +2 over" />
      </div>

      {/* Feedback distribution */}
      {s.feedback.available && s.feedback.total > 0 && (
        <div className="card p-4 mb-8">
          <p className="text-xs font-semibold text-neutral-800 mb-3">AI preview accuracy — buyer feedback</p>
          <div className="grid grid-cols-5 gap-2">
            {["-2", "-1", "0", "1", "2"].map((k) => (
              <div key={k} className="text-center">
                <div className="text-lg font-bold text-ink">{num(s.feedback.accuracyDist[k] || 0)}</div>
                <div className="text-[10px] text-neutral-500 leading-tight">{ACCURACY_LABELS[k]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin ideas report */}
      <div className="flex items-baseline justify-between mb-3 mt-2">
        <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">Admin ideas — full evaluation report</h2>
        <span className="text-xs text-neutral-500">{data.adminIdeas.length} idea{data.adminIdeas.length !== 1 && "s"}</span>
      </div>
      <p className="text-xs text-neutral-500 mb-4">
        Confidential raw model outputs and per-evaluation stats, shown only for ideas owned by admins.
      </p>
      {data.adminIdeas.length === 0 ? (
        <div className="bg-neutral-100 border border-dashed border-neutral-300 rounded-xl p-8 text-center">
          <p className="text-sm text-neutral-500">No ideas owned by admin accounts yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.adminIdeas.map((entry) => (
            <AdminIdeaCard key={String(entry.idea.id)} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
