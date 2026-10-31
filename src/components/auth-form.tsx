"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function AuthForm({
  defaultMode = "login",
  onSuccess,
}: {
  defaultMode?: "login" | "signup";
  onSuccess?: () => void;
}) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        setSubmitting(false);
        return;
      }
      const { error: err } = await signUp(email, password, displayName);
      if (err) {
        setError(err);
        setSubmitting(false);
        return;
      }
    } else {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    onSuccess?.();
  };

  return (
    <div className="max-w-sm mx-auto">
      {/* Mode toggle — segmented control */}
      <div className="seg w-full mb-7">
        <button
          type="button"
          onClick={() => { setMode("login"); setError(null); }}
          className={`seg-opt flex-1 justify-center ${mode === "login" ? "seg-opt-active" : ""}`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(null); }}
          className={`seg-opt flex-1 justify-center ${mode === "signup" ? "seg-opt-active" : ""}`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className="field-label">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How others will see you"
              className="input"
            />
          </div>
        )}

        <div>
          <label className="field-label">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
        </div>

        <div>
          <label className="field-label">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            className="input"
          />
        </div>

        {error && (
          <div className="rounded-[18px] bg-danger-100 p-3.5">
            <p className="text-sm text-danger font-medium">{error}</p>
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn btn-primary btn-block btn-lg">
          {submitting
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
