import { readFile } from "fs/promises";
import { join } from "path";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_FILE = join(process.cwd(), "logs", "evaluations.jsonl");

// Pricing (USD per 1M tokens) — keep in sync with the evaluate pipeline.
const MUSE_IN = 1.25, MUSE_OUT = 4.25;

type Json = Record<string, unknown>;

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

// Unified evaluation record the admin page consumes, regardless of source.
interface NormEval {
  evalId: string;
  startedAt: string;
  totalDurationMs: number;
  ok: boolean;
  error?: string | null;
  models?: Json;
  totals?: Json;
  steps?: Json[];
  output?: Json;
  ideaId: string | null;
  userId: string | null;
  headingInput: string;
  costUsd: number;
}

async function readFileLogs(): Promise<Json[]> {
  try {
    const raw = await readFile(LOG_FILE, "utf8");
    return raw.split("\n").filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l) as Json; } catch { return null; } })
      .filter((r): r is Json => r !== null);
  } catch { return []; }
}

function costFromSteps(steps: Json[]): number {
  let usd = 0;
  for (const s of steps) {
    const u = (s.usage as Json) || {};
    const n = (k: string) => Number(u[k]) || 0;
    if (s.step === 1) {
      usd += n("promptTokens") * MUSE_IN / 1e6 + n("completionTokens") * MUSE_OUT / 1e6;
    } else {
      usd += n("promptTokens") * MUSE_IN / 1e6 + n("completionTokens") * MUSE_OUT / 1e6;
    }
  }
  return usd;
}

function fromDbRow(r: Json): NormEval {
  return {
    evalId: String(r.eval_id || r.id || ""),
    startedAt: String(r.created_at || ""),
    totalDurationMs: Number(r.duration_ms) || 0,
    ok: !!r.ok,
    error: (r.error as string) ?? null,
    models: (r.models as Json) || {},
    totals: (r.totals as Json) || {},
    steps: (r.steps as Json[]) || [],
    output: {
      scores: r.scores, reasonings: r.reasonings, overallScore: r.overall_score,
      aiPreview: r.ai_preview, heading: r.public_heading, competitorResearch: r.competitor_research,
    },
    ideaId: (r.idea_id as string) ?? null,
    userId: (r.user_id as string) ?? null,
    headingInput: norm((r.idea_input as Json)?.heading ?? r.public_heading),
    costUsd: r.est_cost_usd != null ? Number(r.est_cost_usd) : costFromSteps((r.steps as Json[]) || []),
  };
}

function fromFileRecord(r: Json): NormEval {
  const steps = (r.steps as Json[]) || [];
  return {
    evalId: String(r.evalId || ""),
    startedAt: String(r.startedAt || ""),
    totalDurationMs: Number(r.totalDurationMs) || 0,
    ok: !!r.ok,
    error: (r.error as string) ?? null,
    models: (r.models as Json) || {},
    totals: (r.totals as Json) || {},
    steps,
    output: (r.output as Json) || {},
    ideaId: null,
    userId: null,
    headingInput: norm((r.idea as Json)?.heading),
    costUsd: costFromSteps(steps),
  };
}

async function listAllUsers() {
  const users: { id: string; email: string; created_at: string }[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin!.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) users.push({ id: u.id, email: (u.email ?? "").toLowerCase(), created_at: u.created_at ?? "" });
    if (data.users.length < 1000 || page >= 20) break;
    page++;
  }
  return users;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const db = supabaseAdmin!;

  // ── Admin allowlist → user ids ──
  const envAdmins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const { data: adminRows } = await db.from("admins").select("email");
  const adminEmailSet = new Set<string>([...envAdmins, ...((adminRows ?? []).map((r) => norm(r.email)))]);
  const allUsers = await listAllUsers();
  const adminUserIds = new Set(allUsers.filter((u) => adminEmailSet.has(u.email)).map((u) => u.id));

  // ── Core tables ──
  const [ideasRes, purchasesRes] = await Promise.all([
    db.from("ideas").select("id,user_id,heading,idea_type,categories,status,overall_score,price,suggested_price,buy_count,created_at"),
    db.from("purchases").select("idea_id,buyer_id,seller_id,price_paid,created_at"),
  ]);
  const ideas = (ideasRes.data as Json[]) ?? [];
  const purchases = (purchasesRes.data as Json[]) ?? [];

  const savedRes = await db.from("saved_ideas").select("id", { count: "exact", head: true });
  const feedbackRes = await db.from("idea_feedback").select("accuracy,user_rating");
  const feedback = (feedbackRes.data as Json[]) ?? [];

  // ── Evaluations: prefer the durable table; fall back to the JSONL file ──
  const evalRes = await db.from("evaluations").select("*").order("created_at", { ascending: false });
  let evals: NormEval[];
  let evalSource: "supabase" | "file";
  if (!evalRes.error && (evalRes.data?.length ?? 0) > 0) {
    evals = (evalRes.data as Json[]).map(fromDbRow);
    evalSource = "supabase";
  } else {
    evals = (await readFileLogs()).map(fromFileRecord);
    evalSource = "file";
  }

  // ── Idea stats ──
  const statusCounts: Record<string, number> = { draft: 0, unpublished: 0, published: 0, archived: 0 };
  const typeCounts: Record<string, number> = {};
  let publishedScoreSum = 0, publishedScoreN = 0;
  for (const i of ideas) {
    const st = String(i.status ?? "");
    statusCounts[st] = (statusCounts[st] ?? 0) + 1;
    const t = String(i.idea_type ?? "unknown");
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    if (st === "published" && typeof i.overall_score === "number") { publishedScoreSum += i.overall_score as number; publishedScoreN++; }
  }
  const topIdeas = [...ideas].filter((i) => i.status === "published")
    .sort((a, b) => (Number(b.buy_count) || 0) - (Number(a.buy_count) || 0)).slice(0, 5)
    .map((i) => ({ id: i.id, heading: i.heading, buy_count: i.buy_count, price: i.price, overall_score: i.overall_score }));

  // ── Purchase / revenue stats ──
  const totalRevenue = purchases.reduce((s, p) => s + (Number(p.price_paid) || 0), 0);
  const recentPurchases = [...purchases].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8)
    .map((p) => { const idea = ideas.find((i) => i.id === p.idea_id); return { idea_id: p.idea_id, heading: idea?.heading ?? "(unknown)", price_paid: p.price_paid, created_at: p.created_at }; });
  const purchasesByIdea = new Map<string, { count: number; revenue: number }>();
  for (const p of purchases) {
    const key = String(p.idea_id);
    const cur = purchasesByIdea.get(key) ?? { count: 0, revenue: 0 };
    cur.count++; cur.revenue += Number(p.price_paid) || 0; purchasesByIdea.set(key, cur);
  }

  // ── Feedback stats ──
  const accuracyDist: Record<string, number> = { "-2": 0, "-1": 0, "0": 0, "1": 0, "2": 0 };
  let accSum = 0, accN = 0, ratingSum = 0, ratingN = 0;
  for (const f of feedback) {
    if (typeof f.accuracy === "number") { accuracyDist[String(f.accuracy)] = (accuracyDist[String(f.accuracy)] ?? 0) + 1; accSum += f.accuracy as number; accN++; }
    if (typeof f.user_rating === "number") { ratingSum += f.user_rating as number; ratingN++; }
  }

  // ── Evaluation usage stats ──
  let modelTokens = 0, reasoningTokens = 0, searchQueries = 0, durSum = 0, okCount = 0, costSum = 0;
  for (const e of evals) {
    const t = e.totals || {};
    // Older rows used per-provider counters; new ones have a single total.
    modelTokens += Number(t.totalTokens ?? 0) ||
      (Number(t.geminiTotalTokens) || 0) + (Number(t.deepseekTotalTokens) || 0);
    reasoningTokens += Number(t.reasoningTokens ?? t.deepseekReasoningTokens) || 0;
    searchQueries += Number(t.searchQueries) || 0;
    durSum += e.totalDurationMs;
    if (e.ok) okCount++;
    costSum += e.costUsd;
  }

  // ── Admin-owned ideas + matched evaluation runs ──
  const adminIdeasRes = await db.from("ideas").select("*")
    .in("user_id", adminUserIds.size ? Array.from(adminUserIds) : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });
  const adminIdeasRaw = (adminIdeasRes.data as Json[]) ?? [];

  // Paid content lives in idea_details now. The service role reads it directly,
  // then it is merged back on so the report below is unchanged.
  if (adminIdeasRaw.length > 0) {
    const { data: detailRows } = await db
      .from("idea_details")
      .select("idea_id, form_data, reasonings, evaluated_snapshot")
      .in("idea_id", adminIdeasRaw.map((i) => String(i.id)));
    const byId = new Map((detailRows ?? []).map((d) => [String((d as Json).idea_id), d as Json]));
    for (const idea of adminIdeasRaw) {
      const d = byId.get(String(idea.id));
      if (d) {
        idea.form_data = d.form_data;
        idea.reasonings = d.reasonings;
        idea.evaluated_snapshot = d.evaluated_snapshot;
      }
    }
  }

  const adminIdeas = adminIdeasRaw.map((idea) => {
    const fd = (idea.form_data as Json) || {};
    const snap = (idea.evaluated_snapshot as Json) || {};
    const headingSet = new Set([norm(fd.originalHeading), norm(idea.heading), norm(snap.heading)].filter(Boolean));
    const evaluations = evals.filter((e) =>
      (e.ideaId && e.ideaId === idea.id) || (!e.ideaId && headingSet.has(e.headingInput))
    );
    const pstats = purchasesByIdea.get(String(idea.id)) ?? { count: 0, revenue: 0 };
    return { idea, evaluations, purchaseCount: pstats.count, revenue: pstats.revenue };
  });

  return Response.json({
    generatedAt: new Date().toISOString(),
    you: { email: auth.email },
    admins: Array.from(adminEmailSet),
    stats: {
      users: { total: allUsers.length, admins: adminUserIds.size },
      ideas: { total: ideas.length, byStatus: statusCounts, byType: typeCounts, avgPublishedScore: publishedScoreN ? publishedScoreSum / publishedScoreN : null, top: topIdeas },
      purchases: { total: purchases.length, revenue: totalRevenue, recent: recentPurchases },
      saved: { total: savedRes.count ?? 0, available: !savedRes.error },
      feedback: { total: feedback.length, available: !feedbackRes.error, avgAccuracy: accN ? accSum / accN : null, avgUserRating: ratingN ? ratingSum / ratingN : null, accuracyDist },
      evaluations: {
        total: evals.length, ok: okCount, source: evalSource,
        avgDurationMs: evals.length ? durSum / evals.length : 0,
        modelTokens, reasoningTokens, totalTokens: modelTokens,
        searchQueries, estTokenCostUsd: costSum,
      },
    },
    adminIdeas,
  });
}
