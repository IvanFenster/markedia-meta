"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { suggestPrice } from "@/lib/ideas-store";
import { buildSnapshot } from "@/lib/idea-helpers";
import { saveIdeaDetails } from "@/lib/idea-details";
import IdeaForm, {
  emptyForm,
  buildFormData,
  validateForm,
  type IdeaFormState,
} from "@/components/idea-form";
import EvaluationPanel from "@/components/evaluation-panel";
import { ScamFlaggedNotice } from "@/components/scam-notice";
import AuthForm from "@/components/auth-form";
import InfoDot from "@/components/info-dot";
import { EXCLUSIVITY_SHORT, EXCLUSIVITY_FULL } from "@/lib/exclusivity";
import type { IdeaScore } from "@/lib/mock-data";
import type { PreviewParts } from "@/lib/preview";

interface EvalResult {
  scores: IdeaScore;
  reasonings: Record<string, string>;
  overallScore: number;
  aiPreview: string;
  aiPreviewParts: PreviewParts | null;
  clarityScore: number | null;
  scamFlagged: boolean;
  scamReasons: string[];
  /** AI-generated public heading (Step 3). Replaces the seller's typed heading on the market. */
  heading: string;
  competitorResearch: string;
  suggestedPrice: number;
}

// ─── Loading screen during AI evaluation ───
function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="text-center">
        <div className="w-20 h-20 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">AI is evaluating your idea...</h2>
        <p className="text-neutral-600 text-sm max-w-sm mx-auto">
          Searching the web for competitors, scoring across seven criteria, and writing a public preview. This runs three models in sequence and can take a minute.
        </p>
        <div className="mt-6 flex justify-center gap-1.5">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Publish modal (price input) ───
function PublishPricingModal({
  evalResult,
  saving,
  onConfirm,
  onClose,
}: {
  evalResult: EvalResult;
  saving: boolean;
  onConfirm: (price: number, exclusivityPrice: number | null) => void;
  onClose: () => void;
}) {
  const [priceStr, setPriceStr] = useState(String(evalResult.suggestedPrice));
  const [exclStr, setExclStr] = useState("");
  const [priceError, setPriceError] = useState(false);

  const submit = () => {
    const parsed = parseInt(priceStr);
    if (!priceStr.trim() || isNaN(parsed) || parsed < 1) {
      setPriceError(true);
      return;
    }
    const excl = exclStr.trim() ? parseInt(exclStr) : null;
    onConfirm(parsed, excl && excl > 0 ? excl : null);
  };

  return (
    <div className="dialog-backdrop z-50" onClick={onClose}>
      <div className="dialog relative max-w-sm w-full p-7" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-1">Publish to Market</h2>
        <p className="text-sm text-neutral-600 mb-4">Set the price buyers will see.</p>

        <p className="text-xs text-neutral-500 mb-3">
          AI suggested price: <strong className="text-neutral-700">${evalResult.suggestedPrice}</strong>
        </p>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold text-neutral-500">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={priceStr}
            onChange={(e) => { setPriceError(false); setPriceStr(e.target.value.replace(/[^0-9]/g, "")); }}
            className={`w-32 px-4 py-2.5 rounded-xl border outline-none text-lg font-bold text-ink ${
              priceError ? "border-danger" : "border-neutral-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
            }`}
          />
        </div>
        {priceError && <p className="text-xs text-danger mb-3">Enter a price of at least $1</p>}

        {/* Optional exclusivity price */}
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Secure price (optional)</label>
            <InfoDot text={EXCLUSIVITY_FULL} />
          </div>
          <p className="text-[11px] text-neutral-500 mt-0.5 mb-1.5">{EXCLUSIVITY_SHORT}</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-neutral-500">$</span>
            <input
              type="text" inputMode="numeric" value={exclStr} placeholder="Not offered"
              onChange={(e) => setExclStr(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-40 px-4 py-2.5 rounded-xl border border-neutral-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 outline-none text-lg font-bold text-ink"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={submit}
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? "Publishing..." : "Publish"}
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───
export default function NewIdeaPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<IdeaFormState>(emptyForm("startup"));
  const [errs, setErrs] = useState<Set<string>>(new Set());
  const [showErrs, setShowErrs] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ─── Auto-save scaffolding ─────────────────────────────────────────
  // We auto-save a draft when the user navigates away without explicitly
  // saving. Refs let the cleanup effect read the latest values without
  // re-running on every keystroke.
  const formRef = useRef(form);
  const evalRef = useRef<EvalResult | null>(evalResult);
  const userRef = useRef(user);
  const savedRef = useRef(false); // set to true when user explicitly saved/published
  // The id we generate at evaluation time, reused when the idea row is inserted
  // so the `evaluations` row links exactly to this idea.
  const evaluatedIdeaIdRef = useRef<string | null>(null);
  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { evalRef.current = evalResult; }, [evalResult]);
  useEffect(() => { userRef.current = user; }, [user]);

  const hasMeaningfulContent = (s: IdeaFormState): boolean => {
    // We only auto-save if the user has typed something beyond the default.
    // Any of these non-empty fields counts.
    return !!(
      s.heading.trim() ||
      s.problem?.trim() ||
      s.solution?.trim() ||
      s.audience?.trim() ||
      s.differentiator?.trim() ||
      s.skills?.trim() ||
      s.question?.trim() ||
      s.methodology?.trim() ||
      s.equipment?.trim() ||
      s.categories.length > 0
    );
  };

  const autoSaveDraft = () => {
    if (savedRef.current) return;
    const s = formRef.current;
    const u = userRef.current;
    if (!u || !hasMeaningfulContent(s)) return;

    savedRef.current = true; // prevent double-saves
    const cats = s.categories.length > 0 ? s.categories : [s.type === "startup" ? "Startup" : "Research"];
    const formData = buildFormData(s);
    const ev = evalRef.current;
    const snapshot = ev ? buildSnapshot(s.heading || "Untitled draft", cats, formData) : null;

    // Fire-and-forget. Supabase client uses fetch; most browsers keep it alive
    // briefly on navigation. Nothing to await — we're about to unmount.
    const draftId = evaluatedIdeaIdRef.current ?? crypto.randomUUID();
    supabase.from("ideas").insert({
      id: draftId,
      user_id: u.id,
      heading: s.heading.trim() || "Untitled draft",
      idea_type: s.type,
      categories: cats,
      scores: ev?.scores || null,
      overall_score: ev?.overallScore ?? null,
      ai_preview: ev?.aiPreview || null,
      ai_preview_parts: ev?.aiPreviewParts ?? null,
      clarity_score: ev?.clarityScore ?? null,
      scam_flagged: ev?.scamFlagged ?? false,
      scam_reasons: ev?.scamReasons ?? [],
      price: null,
      suggested_price: ev?.suggestedPrice ?? null,
      status: "draft",
    }).then(({ error }) => {
      if (error) { console.error("[lab/new] auto-save draft failed:", error); return; }
      // The paid content is stored separately, behind buyer-only policies.
      void saveIdeaDetails(draftId, {
        form_data: formData,
        reasonings: ev?.reasonings ?? null,
        evaluated_snapshot: snapshot,
      });
    });
  };

  // Catch tab close / refresh / back-forward navigation
  useEffect(() => {
    const handler = () => autoSaveDraft();
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
      // Also runs on in-app route change (component unmount).
      autoSaveDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateForm = (next: IdeaFormState) => {
    setForm(next);
  };

  // ─── Evaluate (calls the Meta Model API) ───
  const handleEvaluate = async () => {
    const v = validateForm(form);
    setErrs(v);
    setShowErrs(v.size > 0);
    if (v.size > 0) return;

    setEvaluating(true);
    setApiError(null);
    // Mint the idea id now so the evaluation row and the (later) idea row share it.
    const ideaId = evaluatedIdeaIdRef.current || crypto.randomUUID();
    evaluatedIdeaIdRef.current = ideaId;
    try {
      const cats = form.categories.length > 0 ? form.categories : [form.type === "startup" ? "Startup" : "Research"];
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId,
          userId: user?.id,
          type: form.type,
          heading: form.heading,
          categories: cats,
          problem: form.type === "startup" ? form.problem : form.question,
          solution: form.type === "startup" ? form.solution : form.methodology,
          audience: form.type === "startup" ? form.audience : undefined,
          differentiator: form.type === "startup" ? form.differentiator : undefined,
          skills: form.skills || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setEvalResult({
        scores: data.scores,
        reasonings: data.reasonings,
        overallScore: data.overallScore,
        aiPreview: data.aiPreview,
        aiPreviewParts: data.aiPreviewParts ?? null,
        clarityScore: data.clarityScore ?? null,
        scamFlagged: !!data.scamFlagged,
        scamReasons: data.scamReasons ?? [],
        heading: data.heading || form.heading,
        competitorResearch: data.competitorResearch || "",
        suggestedPrice: suggestPrice(data.overallScore),
      });
    } catch (err) {
      console.error("[lab/new] evaluation failed:", err);
      setApiError(err instanceof Error ? err.message : "Evaluation failed");
    }
    setEvaluating(false);
  };

  // ─── Save (status: 'unpublished') ───
  const handleSave = async () => {
    if (!user) return;
    const v = validateForm(form);
    setErrs(v);
    setShowErrs(v.size > 0);
    if (v.size > 0) return;

    setSaving(true);
    const cats = form.categories.length > 0 ? form.categories : [form.type === "startup" ? "Startup" : "Research"];
    const formData = buildFormData(form);
    // Public heading = AI heading once evaluated; otherwise the seller's typed one.
    const publicHeading = evalResult ? evalResult.heading : form.heading;
    const snapshot = evalResult ? buildSnapshot(publicHeading, cats, formData) : null;

    const { data, error } = await supabase.from("ideas").insert({
      ...(evaluatedIdeaIdRef.current ? { id: evaluatedIdeaIdRef.current } : {}),
      user_id: user.id,
      heading: publicHeading,
      idea_type: form.type,
      categories: cats,
      scores: evalResult?.scores || null,
      overall_score: evalResult?.overallScore ?? null,
      ai_preview: evalResult?.aiPreview || null,
      ai_preview_parts: evalResult?.aiPreviewParts ?? null,
      clarity_score: evalResult?.clarityScore ?? null,
      scam_flagged: evalResult?.scamFlagged ?? false,
      scam_reasons: evalResult?.scamReasons ?? [],
      price: null,
      suggested_price: evalResult?.suggestedPrice ?? null,
      status: "unpublished",
    }).select("id").single();

    if (!error && data) {
      const detail = await saveIdeaDetails(data.id, {
        form_data: formData,
        reasonings: evalResult?.reasonings ?? null,
        evaluated_snapshot: snapshot,
      });
      if (detail.error) console.error("[lab/new] details save failed:", detail.error);
    }
    setSaving(false);
    if (error) {
      console.error("[lab/new] save failed:", error);
      alert(`Couldn't save: ${error.message}`);
      return;
    }
    savedRef.current = true;
    router.push(data ? `/lab/${data.id}` : "/lab");
  };

  // ─── Save Draft (status: 'draft', heading-only OK) ───
  const handleSaveDraft = async () => {
    if (!user) return;
    if (!form.heading.trim()) {
      setErrs(new Set(["heading"]));
      setShowErrs(true);
      return;
    }
    setSaving(true);
    const cats = form.categories.length > 0 ? form.categories : [form.type === "startup" ? "Startup" : "Research"];
    const formData = buildFormData(form);
    const publicHeading = evalResult ? evalResult.heading : form.heading;
    const snapshot = evalResult ? buildSnapshot(publicHeading, cats, formData) : null;

    const draftRowId = evaluatedIdeaIdRef.current ?? crypto.randomUUID();
    const { error } = await supabase.from("ideas").insert({
      id: draftRowId,
      user_id: user.id,
      heading: publicHeading,
      idea_type: form.type,
      categories: cats,
      scores: evalResult?.scores || null,
      overall_score: evalResult?.overallScore ?? null,
      ai_preview: evalResult?.aiPreview || null,
      ai_preview_parts: evalResult?.aiPreviewParts ?? null,
      clarity_score: evalResult?.clarityScore ?? null,
      scam_flagged: evalResult?.scamFlagged ?? false,
      scam_reasons: evalResult?.scamReasons ?? [],
      price: null,
      suggested_price: evalResult?.suggestedPrice ?? null,
      status: "draft",
    });

    if (!error) {
      const detail = await saveIdeaDetails(draftRowId, {
        form_data: formData,
        reasonings: evalResult?.reasonings ?? null,
        evaluated_snapshot: snapshot,
      });
      if (detail.error) console.error("[lab/new] details save failed:", detail.error);
    }
    setSaving(false);
    if (error) {
      console.error("[lab/new] save draft failed:", error);
      alert(`Couldn't save draft: ${error.message}`);
      return;
    }
    savedRef.current = true;
    router.push("/lab");
  };

  // ─── Publish (only after evaluation, with price) ───
  const handlePublishConfirm = async (price: number, exclusivityPrice: number | null) => {
    if (!user || !evalResult) return;
    const v = validateForm(form);
    setErrs(v);
    setShowErrs(v.size > 0);
    if (v.size > 0) { setShowPublishModal(false); return; }

    setSaving(true);
    const cats = form.categories.length > 0 ? form.categories : [form.type === "startup" ? "Startup" : "Research"];
    const formData = buildFormData(form);
    const publicHeading = evalResult.heading;
    const snapshot = buildSnapshot(publicHeading, cats, formData);

    const { data, error } = await supabase.from("ideas").insert({
      ...(evaluatedIdeaIdRef.current ? { id: evaluatedIdeaIdRef.current } : {}),
      user_id: user.id,
      heading: publicHeading,
      idea_type: form.type,
      categories: cats,
      scores: evalResult.scores,
      overall_score: evalResult.overallScore,
      ai_preview: evalResult.aiPreview,
      ai_preview_parts: evalResult.aiPreviewParts ?? null,
      clarity_score: evalResult.clarityScore ?? null,
      scam_flagged: evalResult.scamFlagged,
      scam_reasons: evalResult.scamReasons,
      price,
      suggested_price: evalResult.suggestedPrice,
      exclusivity_price: exclusivityPrice,
      status: "published",
    }).select("id").single();

    if (!error && data) {
      const detail = await saveIdeaDetails(data.id, {
        form_data: formData,
        reasonings: evalResult.reasonings,
        evaluated_snapshot: snapshot,
      });
      if (detail.error) console.error("[lab/new] details save failed:", detail.error);
    }
    setSaving(false);
    setShowPublishModal(false);
    if (error) {
      console.error("[lab/new] publish failed:", error);
      alert(`Couldn't publish: ${error.message}`);
      return;
    }
    savedRef.current = true;
    router.push(data ? `/lab/${data.id}` : "/lab");
  };

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
          <h1 className="text-2xl font-bold text-ink">Sign in to create an idea</h1>
        </div>
        <AuthForm defaultMode="signup" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {evaluating && <LoadingOverlay />}
      {showPublishModal && evalResult && (
        <PublishPricingModal
          evalResult={evalResult}
          saving={saving}
          onConfirm={handlePublishConfirm}
          onClose={() => setShowPublishModal(false)}
        />
      )}

      {/* Breadcrumb */}
      <Link href="/lab" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Ideas Lab
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ink">Create New Idea</h1>
        <p className="text-neutral-600 mt-1">
          Fill in the details, then evaluate, save, or save as a draft.
        </p>
      </div>

      {apiError && (
        <div className="mb-6 bg-danger-100 border border-danger rounded-xl p-4">
          <p className="text-sm font-medium text-red-800">AI evaluation failed: {apiError}</p>
        </div>
      )}

      {evalResult?.scamFlagged && (
        <ScamFlaggedNotice
          reasons={evalResult.scamReasons}
          onEdit={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mb-6"
        />
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        {/* Form */}
        <div>
          <IdeaForm state={form} onChange={updateForm} errorFields={errs} />

          {showErrs && errs.size > 0 && (
            <div className="mt-6 bg-danger-100 border border-danger rounded-xl p-4">
              <p className="text-sm font-medium text-red-800">
                Please fill in all required fields highlighted above.
              </p>
            </div>
          )}
        </div>

        {/* AI Evaluation panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide mb-3">AI Evaluation</h3>
          <EvaluationPanel
            overallScore={evalResult?.overallScore ?? null}
            scores={evalResult?.scores ?? null}
            reasonings={evalResult?.reasonings ?? null}
            aiPreview={evalResult?.aiPreview ?? null}
            aiPreviewParts={evalResult?.aiPreviewParts ?? null}
            clarityScore={evalResult?.clarityScore ?? null}
            aiHeading={evalResult?.heading ?? null}
          />
        </aside>
      </div>

      {/* Bottom action bar */}
      <div className="mt-10 pt-6 border-t border-neutral-300">
        <div className="flex flex-wrap gap-3 justify-end">
          {!evalResult ? (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saving || evaluating}
                className="btn btn-secondary"
              >
                Save as Draft
              </button>
              <button
                onClick={handleSave}
                disabled={saving || evaluating}
                className="btn btn-secondary"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleEvaluate}
                disabled={saving || evaluating}
                className="btn btn-primary"
              >
                Evaluate with AI
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="btn btn-secondary"
              >
                Save as Draft
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-secondary"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  if (evalResult?.scamFlagged) {
                    alert("This idea is flagged by the abuse check and can't be published. Edit it and evaluate again, or save it as a draft and request a manual review.");
                    return;
                  }
                  setShowPublishModal(true);
                }}
                disabled={saving || !!evalResult?.scamFlagged}
                title={evalResult?.scamFlagged ? "Flagged by the abuse check — can't be published" : undefined}
                className="px-6 py-3 bg-positive hover:bg-positive-700 text-white font-medium rounded-xl transition-colors cursor-pointer text-sm disabled:opacity-50"
              >
                Publish
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
