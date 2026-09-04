"use client";

import { Sticker as StickerIcon, X, GoogleLogo, ArrowRight } from "@phosphor-icons/react";
import { API_BASE } from "@/lib/auth";

interface AuthModalProps {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ mode, onClose }: AuthModalProps) {
  const refQuery = (() => {
    if (typeof window === "undefined") return "";
    const ref = window.localStorage.getItem("stickersync_ref");
    return ref ? `?ref=${ref}` : "";
  })();

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
          <span className="die-cut flex h-11 w-11 items-center justify-center">
            <StickerIcon size={22} weight="fill" className="text-accent" />
          </span>
          <button onClick={onClose} aria-label="Close" className="text-white/40 transition-colors hover:text-white">
            <X size={20} />
          </button>
        </div>

        <h3 className="mt-4 font-display text-xl font-extrabold tracking-tight">
          {mode === "signup" ? "Start hunting stickers" : "Welcome back, hunter"}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/50">
          {mode === "signup"
            ? "New accounts get 3 free downloads — no card needed."
            : "Sign in to keep your credits and downloads."}
        </p>

        <a
          href={`${API_BASE}/auth/oauth/google/start${refQuery}`}
          className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-full bg-accent px-5 py-3.5 text-sm font-bold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(254,44,85,0.4)] active:scale-95"
        >
          <GoogleLogo size={19} weight="fill" />
          {mode === "signup" ? "Continue with Google" : "Sign in with Google"}
          <ArrowRight size={16} weight="bold" />
        </a>

        <p className="mt-4 text-center text-xs leading-relaxed text-white/35">
          Google keeps the bots out — one tap and you&apos;re in.
          <br />
          We never see your password, only your email.
        </p>
      </div>
    </div>
  );
}
