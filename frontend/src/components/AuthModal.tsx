"use client";

import { useState } from "react";
import {
  Sticker as StickerIcon,
  X,
  EnvelopeSimple,
  LockSimple,
  UserPlus,
  SignIn,
  GoogleLogo,
} from "@phosphor-icons/react";
import {
  API_BASE,
  signup as apiSignup,
  login as apiLogin,
} from "@/lib/auth";

interface AuthModalProps {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ mode, onModeChange, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (m: "login" | "signup") => {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const refCode = window.localStorage.getItem("stickersync_ref");
      const result =
        m === "signup"
          ? await apiSignup(email.trim(), password, refCode || undefined)
          : await apiLogin(email.trim(), password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[24px] border border-white/10 bg-raised p-7 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <StickerIcon size={28} weight="fill" className="text-accent" />
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <h3 className="mt-3 font-display text-xl font-bold tracking-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h3>
        <p className="mt-1.5 font-body text-sm leading-relaxed text-muted">
          {mode === "signup"
            ? "New accounts get 3 free downloads — no card needed."
            : "Sign in to keep your credits and downloads."}
        </p>

        <a
          href={`${API_BASE}/auth/oauth/google/start${
            typeof window !== "undefined" && window.localStorage.getItem("stickersync_ref")
              ? `?ref=${window.localStorage.getItem("stickersync_ref")}`
              : ""
          }`}
          className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-full border border-line bg-raised px-5 py-3 font-body text-sm font-semibold text-foreground transition-all hover:border-muted active:translate-y-px active:scale-[0.98]"
        >
          <GoogleLogo size={18} weight="fill" />
          {mode === "signup" ? "Continue with Google" : "Sign in with Google"}
        </a>
        <div className="my-4 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="font-body text-xs uppercase tracking-wide text-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            handle(mode);
          }}
        >
          <div>
            <label
              htmlFor="auth-email"
              className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Email
            </label>
            <div className="relative">
              <EnvelopeSimple
                size={18}
                weight="bold"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full rounded-2xl border border-line bg-raised py-3 pl-11 pr-4 font-body text-base text-foreground placeholder:text-muted/70 focus-visible:border-accent"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="auth-password"
              className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Password
            </label>
            <div className="relative">
              <LockSimple
                size={18}
                weight="bold"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="auth-password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-2xl border border-line bg-raised py-3 pl-11 pr-4 font-body text-base text-foreground placeholder:text-muted/70 focus-visible:border-accent"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-error-soft px-3 py-2 font-body text-xs font-medium text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-body text-sm font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? (
              "…"
            ) : mode === "signup" ? (
              <>
                <UserPlus size={18} weight="bold" /> Create account
              </>
            ) : (
              <>
                <SignIn size={18} weight="bold" /> Sign in
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => {
            setError(null);
            onModeChange(mode === "signup" ? "login" : "signup");
          }}
          className="mt-4 w-full font-body text-sm text-muted transition-colors hover:text-foreground"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New here? Create an account — get 3 free downloads"}
        </button>
      </div>
    </div>
  );
}
