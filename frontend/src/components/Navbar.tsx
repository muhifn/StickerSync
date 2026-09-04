"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Coins,
  Globe,
  SignIn,
  ArrowRight,
  CaretDown,
  SignOut,
  HouseSimple,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { getToken, clearSession, refreshBalance } from "@/lib/auth";
import { dict, detectLocale, persistLocale, type Locale } from "@/lib/i18n";

export function Navbar({ variant }: { variant: "landing" | "app" }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  const [signedIn, setSignedIn] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState<"login" | "signup" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const t = dict[locale];

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const refreshBal = useCallback(async () => {
    const b = await refreshBalance();
    setBalance(b);
  }, []);

  useEffect(() => {
    if (getToken()) {
      setSignedIn(true);
      refreshBal();
    } else {
      setSignedIn(false);
    }
  }, [refreshBal]);

  // close dropdown on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const switchLocale = (l: Locale) => {
    persistLocale(l);
    setLocale(l);
  };

  // HARD navigation: clears all client state + guards, guarantees full page transition.
  // (router.push("/") from /app could dedup/fail silently — this was the back-to-home bug.)
  const goHome = () => window.location.assign("/");
  const goApp = () => window.location.assign("/app");

  const handleSignOut = () => {
    clearSession();
    window.location.assign("/");
  };

  // lazy-load modal to keep the navbar light
  const [AuthModal, setAuthModal] = useState<null | React.ComponentType<{
    mode: "login" | "signup";
    onModeChange: (m: "login" | "signup") => void;
    onClose: () => void;
    onSuccess: () => void;
  }>>(null);
  useEffect(() => {
    if (authOpen && !AuthModal) {
      import("@/components/AuthModal").then((m) => setAuthModal(() => m.AuthModal));
    }
  }, [authOpen, AuthModal]);

  return (
    <>
      <nav
        className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl"
        style={{ background: "rgba(3,3,3,0.8)" }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3.5 md:px-10">
          <a href="/" className="group inline-flex items-center font-display text-xl font-extrabold tracking-tight">
            Sticker
            <span className="ml-0.5 inline-block -rotate-3 rounded-md border-2 border-white/90 bg-white/5 px-1.5 py-0.5 transition-transform group-hover:rotate-0">
              <em className="not-italic text-accent">Sync</em>
            </span>
          </a>

          {variant === "landing" && (
            <div className="hidden items-center gap-6 lg:flex">
              <a href="#how" className="font-body text-[13px] font-medium text-white/45 transition-colors hover:text-white">
                {t.nav.howItWorks}
              </a>
              <a href="#pricing" className="font-body text-[13px] font-medium text-white/45 transition-colors hover:text-white">
                {t.nav.pricing}
              </a>
              <a href="#safety" className="font-body text-[13px] font-medium text-white/45 transition-colors hover:text-white">
                {t.nav.safety}
              </a>
              <a href="#faq" className="font-body text-[13px] font-medium text-white/45 transition-colors hover:text-white">
                {t.nav.faq}
              </a>
            </div>
          )}

          {variant === "app" && (
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                goHome();
              }}
              className="hidden items-center gap-1.5 font-body text-[13px] font-medium text-white/45 transition-colors hover:text-white lg:flex"
            >
              <HouseSimple size={14} /> {t.nav.backHome}
            </a>
          )}

          <div className="flex items-center gap-3">
            {/* Language switch */}
            <div
              className="flex items-center gap-1 rounded-full border border-white/10 p-0.5"
              role="group"
              aria-label="Language"
            >
              {(["en", "id"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => switchLocale(l)}
                  aria-pressed={locale === l}
                  className={`rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    locale === l ? "bg-white text-background" : "text-white/40 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {!signedIn ? (
              <button
                onClick={() => setAuthOpen("signup")}
                className="flex min-h-[34px] items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-body text-[13px] font-bold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(254,44,85,0.5)] active:scale-95"
              >
                <SignIn size={14} weight="bold" /> {t.nav.signIn}
              </button>
            ) : variant === "landing" ? (
              <button
                onClick={goApp}
                className="flex min-h-[34px] items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-body text-[13px] font-bold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(254,44,85,0.5)] active:scale-95"
              >
                <MagnifyingGlass size={14} weight="bold" /> {t.nav.openApp}
              </button>
            ) : (
              <div className="relative flex items-center" ref={menuRef}>
                {/* Balance chip: DISPLAY ONLY — no sign-out on click (bug fix) */}
                <div
                  className="flex items-center gap-1.5 rounded-l-full border border-r-0 border-white/10 bg-raised px-3.5 py-2 font-mono text-xs font-semibold text-white/80"
                  aria-label={`Balance: ${balance ?? "loading"}`}
                >
                  <Coins size={13} weight="fill" className="text-accent" />
                  {balance ?? "…"}
                </div>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                  className="flex min-h-[34px] items-center rounded-r-full border border-white/10 bg-raised px-2.5 py-2 text-white/40 transition-colors hover:text-white"
                >
                  <CaretDown size={13} weight="bold" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] w-52 overflow-hidden rounded-2xl border border-white/10 bg-raised shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]"
                  >
                    <div className="border-b border-white/10 px-4 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                        Balance
                      </p>
                      <p className="mt-0.5 font-display text-base font-bold">{balance ?? "…"}</p>
                    </div>
                    <button
                      role="menuitem"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 px-4 py-3 font-body text-[13px] font-medium text-error transition-colors hover:bg-error-soft"
                    >
                      <SignOut size={15} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {authOpen && AuthModal && (
        <AuthModal
          mode={authOpen}
          onModeChange={(m) => setAuthOpen(m)}
          onClose={() => setAuthOpen(null)}
          onSuccess={() => {
            setAuthOpen(null);
            router.push("/app");
          }}
        />
      )}
    </>
  );
}
