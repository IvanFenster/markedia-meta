"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { suggestPrice } from "@/lib/ideas-store";
import {
  isEvaluationStale,
  buildSnapshot,
  canEvaluate,
  type DbIdea,
  type IdeaStatus,
} from "@/lib/idea-helpers";
import IdeaForm, {
  formStateFromDb,
  buildFormData,
  validateForm,
  type IdeaFormState,
} from "@/components/idea-form";
import EvaluationPanel from "@/components/evaluation-panel";
import IdeaDescriptionPanel from "@/components/idea-description-panel";
import AuthForm from "@/components/auth-form";
import InfoDot from "@/components/info-dot";
import { readPreviewParts } from "@/lib/preview";
import { readClarity } from "@/lib/clarity";
import { loadIdeaDetails, saveIdeaDetails } from "@/lib/idea-details";
import { ScamFlaggedNotice } from "@/components/scam-notice";
import { EXCLUSIVITY_SHORT, EXCLUSIVITY_FULL } from "@/lib/exclusivity";

// Seller input for the optional exclusivity price. Shared by the publish and
// change-price modals.
function ExclusivityField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-4 pt-4 border-t border-neutral-200">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Secure price (optional)</label>
        <InfoDot text={EXCLUSIVITY_FULL} />
      </div>
      <p className="text-[11px] text-neutral-500 mt-0.5 mb-1.5">{EXCLUSIVITY_SHORT}</p>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-neutral-500">$</span>
        <input
          type="text" inputMode="numeric" value={value} placeholder="Not offered"
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-40 px-4 py-2.5 rounded-xl border border-neutral-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 outline-none text-lg font-bold text-ink"
        />
      </div>
    </div>
  );
}

// ─── Loading overlay ───
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="text-center">
        <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-neutral-800">{message}</p>
      </div>
    </div>
  );
}

// ─── Publish modal ───
function PublishPricingModal({
  idea,
  saving,
  onConfirm,
  onClose,
}: {
  idea: DbIdea;
  saving: boolean;
  onConfirm: (price: number, exclusivityPrice: number | null) => void;
  onClose: () => void;
}) {
  const sp = idea.suggested_price || (idea.overall_score ? suggestPrice(idea.overall_score) : 10);
  const [priceStr, setPriceStr] = useState(String(idea.price ?? sp));
  const [exclStr, setExclStr] = useState(idea.exclusivity_price != null ? String(idea.exclusivity_price) : "");
  const [priceError, setPriceError] = useState(false);

  const submit = () => {
    const parsed = parseInt(priceStr);
    if (!priceStr.trim() || isNaN(parsed) || parsed < 1) { setPriceError(true); return; }
    const excl = exclStr.trim() ? parseInt(exclStr) : null;
    onConfirm(parsed, excl && excl > 0 ? excl : null);
  };

  return (
    <div className="dialog-backdrop z-50" onClick={onClose}>
      <div className="dialog relative max-w-sm w-full p-7" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-1">Publish to Market</h2>
        <p className="text-sm text-neutral-600 mb-4">{idea.heading}</p>
        <p className="text-xs text-neutral-500 mb-3">AI suggested price: <strong className="text-neutral-700">${sp}</strong></p>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold text-neutral-500">$</span>
          <input
            type="text" inputMode="numeric" value={priceStr}
            onChange={(e) => { setPriceError(false); setPriceStr(e.target.value.replace(/[^0-9]/g, "")); }}
            className={`w-32 px-4 py-2.5 rounded-xl border outline-none text-lg font-bold text-ink ${
              priceError ? "border-danger" : "border-neutral-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
            }`}
          />
        </div>
        {priceError && <p className="text-xs text-danger mb-3">Enter a price of at least $1</p>}
        <ExclusivityField value={exclStr} onChange={setExclStr} />
        <div className="flex gap-3 mt-4">
          <button onClick={submit} disabled={saving}
            className="btn btn-primary flex-1">
            {saving ? "Publishing..." : "Publish"}
          </button>
          <button onClick={onClose}
            className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit price modal ───
function EditPriceModal({
  idea,
  stale,
  saving,
  onConfirm,
  onReevaluate,
  onClose,
}: {
  idea: DbIdea;
  stale: boolean;
  saving: boolean;
  onConfirm: (price: number, exclusivityPrice: number | null) => void;
  onReevaluate: () => void;
  onClose: () => void;
}) {
  const hasEval = idea.scores != null;
  const suggested =
    idea.suggested_price ?? (idea.overall_score ? suggestPrice(idea.overall_score) : null);
  const [priceStr, setPriceStr] = useState(String(idea.price ?? suggested ?? ""));
  const [exclStr, setExclStr] = useState(idea.exclusivity_price != null ? String(idea.exclusivity_price) : "");
  const [priceError, setPriceError] = useState(false);

  const submit = () => {
    const parsed = parseInt(priceStr);
    if (!priceStr.trim() || isNaN(parsed) || parsed < 1) { setPriceError(true); return; }
    const excl = exclStr.trim() ? parseInt(exclStr) : null;
    onConfirm(parsed, excl && excl > 0 ? excl : null);
  };

  return (
    <div className="dialog-backdrop z-50" onClick={onClose}>
      <div className="dialog relative max-w-sm w-full p-7" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-1">{idea.price != null ? "Change price" : "Set price"}</h2>
        <p className="text-sm text-neutral-600 mb-4">{idea.heading}</p>

        {/* AI suggestion area */}
        {!hasEval ? (
          <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-3 mb-4">
            <p className="text-xs text-neutral-600 leading-relaxed">
              Evaluate this idea with AI first to get a suggested price based on its scores.
            </p>
          </div>
        ) : stale ? (
          <div className="bg-accent-100 border border-accent-200 rounded-xl p-3 mb-4">
            <p className="text-xs text-accent-800 leading-relaxed mb-2">
              You&apos;ve edited this idea since its last evaluation, so the AI price suggestion is out of date.
            </p>
            <button
              onClick={onReevaluate}
              className="text-xs font-semibold text-accent-700 hover:text-amber-900 underline cursor-pointer"
            >
              Re-evaluate to see the AI-suggested price
            </button>
          </div>
        ) : suggested != null ? (
          <div className="bg-accent-100 border border-accent-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-accent-700/80 uppercase tracking-wide">AI-suggested price</p>
              <p className="text-lg font-bold text-accent-800">${suggested}</p>
            </div>
            <button
              onClick={() => { setPriceError(false); setPriceStr(String(suggested)); }}
              className="text-xs font-semibold text-accent-700 hover:text-amber-900 border border-accent-300 hover:border-accent-400 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              Use this
            </button>
          </div>
        ) : null}

        <label className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Your price</label>
        <div className="flex items-center gap-2 mb-1 mt-1">
          <span className="text-lg font-bold text-neutral-500">$</span>
          <input
            type="text" inputMode="numeric" value={priceStr}
            onChange={(e) => { setPriceError(false); setPriceStr(e.target.value.replace(/[^0-9]/g, "")); }}
            className={`w-32 px-4 py-2.5 rounded-xl border outline-none text-lg font-bold text-ink ${
              priceError ? "border-danger" : "border-neutral-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
            }`}
          />
        </div>
        {priceError && <p className="text-xs text-danger mb-3">Enter a price of at least $1</p>}

        <ExclusivityField value={exclStr} onChange={setExclStr} />

        <div className="flex gap-3 mt-4">
          <button onClick={submit} disabled={saving}
            className="btn btn-primary flex-1">
            {saving ? "Saving..." : "Save price"}
          </button>
          <button onClick={onClose}
            className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm modal (delete / archive / etc.) ───
function ConfirmModal({
  title, message, confirmLabel, danger, onConfirm, onClose, busy,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <div className="dialog-backdrop z-50" onClick={onClose}>
      <div className="dialog relative max-w-sm w-full p-7" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-1">{title}</h2>
        <p className="text-sm text-neutral-600 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className={`px-5 py-2.5 text-white font-medium rounded-xl transition-colors cursor-pointer text-sm disabled:opacity-50 ${
              danger ? "bg-danger hover:bg-danger" : "bg-accent hover:bg-accent-600"
            }`}>
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───
export default function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [idea, setIdea] = useState<DbIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formState, setFormState] = useState<IdeaFormState | null>(null);
  const [errs, setErrs] = useState<Set<string>>(new Set());
  const [showErrs, setShowErrs] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const fetchIdea = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ideas")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[lab/detail] failed to load idea:", error);
    }
    if (!data) {
      setNotFound(true);
    } else {
      // The paid content lives in idea_details, behind its own policies.
      const details = await loadIdeaDetails(id);
      Object.assign(data, details);
      setIdea(data as DbIdea);
      setNotFound(false);
    }
    setLoading(false);
  }, [user, id]);

  useEffect(() => {
    if (!user) return;
    void (async () => { await fetchIdea(); })();
  }, [user, fetchIdea]);

  const startEditing = () => {
    if (!idea) return;
    setFormState(formStateFromDb(idea.idea_type, idea.heading, idea.categories, idea.form_data));
    setErrs(new Set());
    setShowErrs(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFormState(null);
  };

  // ─── Save edits (no AI, keeps current eval but flags as stale automatically) ───
  const handleSaveEdit = async () => {
    if (!idea || !formState) return;
    const v = validateForm(formState);
    setErrs(v);
    setShowErrs(v.size > 0);
    if (v.size > 0) return;

    setBusy("save");
    const cats = formState.categories.length > 0
      ? formState.categories
      : [formState.type === "startup" ? "Startup" : "Research"];
    const { error } = await supabase.from("ideas").update({
      // Keep the AI-generated public heading if this idea was already evaluated;
      // the edited typed heading is preserved inside form_data.originalHeading.
      heading: idea.scores ? idea.heading : formState.heading,
      idea_type: formState.type,
      categories: cats,
    }).eq("id", idea.id);
    if (!error) {
      const detailErr = await saveIdeaDetails(idea.id, {
        form_data: buildFormData(formState),
        reasonings: idea.reasonings,
        evaluated_snapshot: idea.evaluated_snapshot,
      });
      if (detailErr.error) console.error("[lab/detail] details save failed:", detailErr.error);
    }
    setBusy(null);
    if (error) {
      console.error("[lab/detail] save failed:", error);
      alert(`Couldn't save: ${error.message}`);
      return;
    }
    setEditing(false);
    setFormState(null);
    fetchIdea();
  };

  // ─── Re-evaluate (uses current form fields if editing, else DB row) ───
  const handleEvaluate = async () => {
    if (!idea) return;

    // If editing, validate form first.
    // `heading` here is the seller's TYPED heading (model input), not the public
    // AI heading — pull it from form_data.originalHeading, falling back to the
    // column for legacy rows.
    let heading = String(
      (idea.form_data as Record<string, unknown>)?.originalHeading || idea.heading
    );
    let cats = idea.categories || [];
    let formData = idea.form_data || {};
    let typeForApi = idea.idea_type;

    if (editing && formState) {
      const v = validateForm(formState);
      setErrs(v);
      setShowErrs(v.size > 0);
      if (v.size > 0) return;
      heading = formState.heading;
      cats = formState.categories.length > 0
        ? formState.categories
        : [formState.type === "startup" ? "Startup" : "Research"];
      formData = buildFormData(formState);
      typeForApi = formState.type;
    } else if (!canEvaluate(idea)) {
      alert("Heading, problem, and solution are required to evaluate. Click Edit to fill them in.");
      return;
    }

    setBusy("eval");
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId: idea.id,
          userId: user?.id,
          type: typeForApi,
          heading,
          categories: cats.length > 0 ? cats : [typeForApi === "startup" ? "Startup" : "Research"],
          problem: typeForApi === "startup" ? formData.problem : formData.question,
          solution: typeForApi === "startup" ? formData.solution : formData.methodology,
          audience: typeForApi === "startup" ? formData.audience : undefined,
          differentiator: typeForApi === "startup" ? formData.differentiator : undefined,
          skills: formData.skills || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      const sp = suggestPrice(data.overallScore);
      // Public heading = the AI-generated one (Step 3); typed heading stays in form_data.
      const publicHeading = data.heading || heading;
      const snapshot = buildSnapshot(publicHeading, cats, formData);

      const { error: updErr } = await supabase.from("ideas").update({
        heading: publicHeading,
        idea_type: typeForApi,
        categories: cats,
        scores: data.scores,
        overall_score: data.overallScore,
        ai_preview: data.aiPreview,
        ai_preview_parts: data.aiPreviewParts ?? null,
        clarity_score: data.clarityScore ?? null,
        scam_flagged: !!data.scamFlagged,
        scam_reasons: data.scamReasons ?? [],
        scam_review_requested: false,
        suggested_price: sp,
      }).eq("id", idea.id);
      if (updErr) throw new Error(updErr.message);

      // Reasoning and the source text are paid content — they live behind
      // idea_details, not on the publicly readable ideas row.
      const detailErr = await saveIdeaDetails(idea.id, {
        form_data: formData,
        reasonings: data.reasonings,
        evaluated_snapshot: snapshot,
      });
      if (detailErr.error) throw new Error(detailErr.error);

      setEditing(false);
      setFormState(null);
      fetchIdea();
    } catch (err) {
      console.error("[lab/detail] evaluate failed:", err);
      alert(`AI evaluation failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    setBusy(null);
  };

  // ─── Status transitions ───
  const setStatus = async (status: IdeaStatus, extraFields: Record<string, unknown> = {}) => {
    if (!idea) return;
    setBusy("status");
    const updates: Record<string, unknown> = { status, ...extraFields };
    if (status === "archived") updates.archived_at = new Date().toISOString();
    if (idea.status === "archived" && status !== "archived") updates.archived_at = null;

    const { error } = await supabase.from("ideas").update(updates).eq("id", idea.id);
    setBusy(null);
    if (error) {
      console.error("[lab/detail] status change failed:", error);
      alert(`Couldn't update: ${error.message}`);
      return;
    }
    fetchIdea();
  };

  // Records the request only. The review workflow itself is not built yet.
  const handleRequestReview = async () => {
    if (!idea) return;
    setBusy("review");
    const { error } = await supabase
      .from("ideas")
      .update({ scam_review_requested: true, scam_review_requested_at: new Date().toISOString() })
      .eq("id", idea.id);
    setBusy(null);
    if (error) {
      console.error("[lab/detail] review request failed:", error);
      alert(`Couldn't send the request: ${error.message}`);
      return;
    }
    fetchIdea();
  };

  const handlePublish = async (price: number, exclusivityPrice: number | null) => {
    if (!idea) return;
    setBusy("status");
    const { error } = await supabase.from("ideas").update({
      status: "published",
      price,
      exclusivity_price: exclusivityPrice,
      archived_at: null,
    }).eq("id", idea.id);
    setBusy(null);
    setShowPublish(false);
    if (error) {
      console.error("[lab/detail] publish failed:", error);
      alert(`Couldn't publish: ${error.message}`);
      return;
    }
    fetchIdea();
  };

  const handleUpdatePrice = async (price: number, exclusivityPrice: number | null) => {
    if (!idea) return;
    setBusy("price");
    const { error } = await supabase.from("ideas").update({ price, exclusivity_price: exclusivityPrice }).eq("id", idea.id);
    setBusy(null);
    setShowPrice(false);
    if (error) {
      console.error("[lab/detail] price update failed:", error);
      alert(`Couldn't update price: ${error.message}`);
      return;
    }
    fetchIdea();
  };

  const handleDelete = async () => {
    if (!idea) return;
    setBusy("delete");
    const { error } = await supabase.from("ideas").delete().eq("id", idea.id);
    setBusy(null);
    setShowDelete(false);
    if (error) {
      console.error("[lab/detail] delete failed:", error);
      alert(`Couldn't delete: ${error.message}`);
      return;
    }
    router.push("/lab");
  };

  // ─── Render ───
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
          <h1 className="text-2xl font-bold text-ink">Sign in to view this idea</h1>
        </div>
        <AuthForm defaultMode="login" />
      </div>
    );
  }

  if (notFound || !idea) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink mb-2">Idea not found</h1>
        <p className="text-neutral-600 mb-6">It may have been deleted, or it doesn&apos;t belong to you.</p>
        <Link href="/lab" className="btn btn-primary">
          Back to Ideas Lab
        </Link>
      </div>
    );
  }

  const scamFlagged = !!idea.scam_flagged;
  const scamReasons = idea.scam_reasons ?? [];
  const stale = isEvaluationStale(idea);
  const hasEval = idea.scores != null;
  const showEvalButton = hasEval ? stale : canEvaluate(idea);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {busy === "eval" && <LoadingOverlay message="AI is evaluating your idea..." />}
      {showPublish && (
        <PublishPricingModal idea={idea} saving={busy === "status"} onConfirm={handlePublish} onClose={() => setShowPublish(false)} />
      )}
      {showPrice && (
        <EditPriceModal
          idea={idea}
          stale={stale}
          saving={busy === "price"}
          onConfirm={handleUpdatePrice}
          onReevaluate={() => { setShowPrice(false); handleEvaluate(); }}
          onClose={() => setShowPrice(false)}
        />
      )}
      {showDelete && (
        <ConfirmModal
          title="Delete this idea?"
          message="This permanently removes the idea. Buyers who already purchased it will keep their copy in Purchased."
          confirmLabel="Delete forever"
          danger
          busy={busy === "delete"}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
        />
      )}

      {/* Breadcrumb */}
      <Link href="/lab" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Ideas Lab
      </Link>

      {/* Exclusive notice for the seller */}
      {idea.is_exclusive && (
        <div className="mb-6 bg-neutral-100 border border-neutral-300 rounded-2xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-ink shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-ink">This idea has been secured</p>
            <p className="text-xs text-neutral-800/80 mt-0.5 leading-relaxed">
              It&apos;s been removed from the marketplace and can no longer be purchased. Everyone who already bought it keeps full access.
            </p>
          </div>
        </div>
      )}

      {scamFlagged && (
        <ScamFlaggedNotice
          reasons={scamReasons}
          onEdit={startEditing}
          onRequestReview={handleRequestReview}
          reviewRequested={!!idea.scam_review_requested}
          requesting={busy === "review"}
          className="mb-6"
        />
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        {/* Left: description (or form when editing) */}
        <div>
          {editing && formState ? (
            <>
              <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-4">Editing idea</h2>
              <IdeaForm state={formState} onChange={setFormState} errorFields={errs} />
              {showErrs && errs.size > 0 && (
                <div className="mt-6 bg-danger-100 border border-danger rounded-xl p-4">
                  <p className="text-sm font-medium text-red-800">Please fill in all required fields highlighted above.</p>
                </div>
              )}
            </>
          ) : (
            <IdeaDescriptionPanel idea={idea} />
          )}
        </div>

        {/* Right: AI evaluation */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">AI Evaluation</h3>
          <EvaluationPanel
            overallScore={idea.overall_score}
            scores={idea.scores}
            reasonings={idea.reasonings}
            aiPreview={idea.ai_preview}
            aiPreviewParts={readPreviewParts(idea.ai_preview_parts)}
            clarityScore={readClarity(idea.clarity_score)}
            aiHeading={idea.scores ? idea.heading : null}
            staleNotice={stale && !editing}
          />
        </aside>
      </div>

      {/* Action bar */}
      <div className="mt-10 pt-6 border-t border-neutral-300 sticky bottom-0 bg-neutral-100 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4 -mb-10 z-10">
        <div className="flex flex-wrap gap-2 justify-end items-center">
          {/* Editing mode buttons */}
          {editing ? (
            <>
              <button
                onClick={cancelEditing}
                disabled={busy !== null}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={busy !== null}
                className="btn btn-dark"
              >
                {busy === "save" ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={handleEvaluate}
                disabled={busy !== null}
                className="btn btn-primary"
              >
                Save & {hasEval ? "Re-evaluate" : "Evaluate"}
              </button>
            </>
          ) : (
            <>
              {/* Destructive group */}
              <button
                onClick={() => setShowDelete(true)}
                disabled={busy !== null}
                className="px-4 py-2.5 text-neutral-500 hover:text-danger font-medium rounded-xl transition-colors cursor-pointer text-sm disabled:opacity-50"
              >
                Delete
              </button>

              {/* Archive / restore */}
              {idea.status === "archived" ? (
                <button
                  onClick={() => setStatus("unpublished")}
                  disabled={busy !== null}
                  className="btn btn-secondary"
                >
                  Restore
                </button>
              ) : (
                <button
                  onClick={() => setStatus("archived")}
                  disabled={busy !== null}
                  className="btn btn-secondary"
                >
                  Archive
                </button>
              )}

              {/* Convert draft <-> unpublished */}
              {idea.status === "draft" && (
                <button
                  onClick={() => setStatus("unpublished")}
                  disabled={busy !== null}
                  className="btn btn-secondary"
                >
                  Mark as ready (not draft)
                </button>
              )}
              {idea.status === "unpublished" && (
                <button
                  onClick={() => setStatus("draft")}
                  disabled={busy !== null}
                  className="btn btn-secondary"
                >
                  Make draft
                </button>
              )}

              {/* Edit */}
              <button
                onClick={startEditing}
                disabled={busy !== null}
                className="btn btn-secondary"
              >
                Edit
              </button>

              {/* Change / set price */}
              <button
                onClick={() => setShowPrice(true)}
                disabled={busy !== null}
                className="btn btn-secondary"
              >
                {idea.price != null ? "Change price" : "Set price"}
              </button>

              {/* Evaluate (only if changes detected, or first eval possible) */}
              {showEvalButton && (
                <button
                  onClick={handleEvaluate}
                  disabled={busy !== null}
                  className="btn btn-primary"
                >
                  {hasEval ? "Re-evaluate" : "Evaluate with AI"}
                </button>
              )}

              {/* Publish / Unpublish */}
              {idea.status === "published" ? (
                <button
                  onClick={() => setStatus("unpublished")}
                  disabled={busy !== null}
                  className="btn btn-dark"
                >
                  Unpublish
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (scamFlagged) {
                      alert("This idea is flagged by the abuse check and can't be published. Edit it and re-evaluate, or request a manual review.");
                      return;
                    }
                    if (!hasEval) {
                      alert("Please evaluate the idea before publishing.");
                      return;
                    }
                    setShowPublish(true);
                  }}
                  disabled={busy !== null || scamFlagged}
                  title={scamFlagged ? "Flagged by the abuse check — can't be published" : undefined}
                  className={`px-5 py-2.5 font-medium rounded-xl transition-colors text-sm ${
                    hasEval && !scamFlagged
                      ? "bg-positive hover:bg-positive-700 text-white cursor-pointer"
                      : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                  }`}
                >
                  Publish
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
