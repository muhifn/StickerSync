"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Coins,
  Globe,
  SignIn,
  ArrowRight,
  CaretDown,
  SignOut,
  HouseSimple,
} from "@phosphor-icons/react";
import { API_BASE, getToken, clearSession, refreshBalance } from "@/lib/auth";
import { dict, detectLocale, persistLocale, type Locale } from "@/lib/i18n";

const PoolPill = memo(function PoolPill() {
  const [pool, setPool] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/pool`);
        const data = await res.json();
        if (alive) setPool(data.pool);
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  if (pool === null) return null;
  return (
    <a
      href="#how"
      className="hidden md:flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-2 font-body text-xs font-semibold text-foreground transition-colors hover:opacity-90"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <Gift size={14} weight="fill" className="text-accent" />
      World pool: <span className="font-mono">{pool.toLocaleString()}</span>
    </a>
  );
});

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

  const handleSignOut = () => {
    clearSession();
    setMenuOpen(false);
    setSignedIn(false);
    setBalance(null);
    router.push("/");
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
      <nav className="sticky top-0 z-30 border-b border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:gap-4 md:px-10">
          <a href="/" className="font-display text-lg font-bold tracking-tight">
            Sticker<span className="text-accent">Sync</span>
          </a>

          {variant === "landing" && (
            <a
              href="#how"
              className="ml-4 hidden font-body text-sm font-medium text-muted transition-colors hover:text-foreground lg:block"
            >
              {t.nav.howItWorks}
            </a>
          )}

          <div className="mx-auto">
            <PoolPill />
          </div>

          <div
            className="flex items-center rounded-full border border-line bg-raised p-1"
            role="group"
            aria-label="Language"
          >
            {(["en", "id"] as const).map((l) => (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                aria-pressed={locale === l}
                className={`flex min-h-[32px] items-center gap-1 rounded-full px-3 font-body text-xs font-semibold uppercase tracking-wide transition-colors ${
                  locale === l ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground"
                }`}
              >
                <Globe size={13} />
                {l === "en" ? "EN" : "ID"}
              </button>
            ))}
          </div>

          {!signedIn ? (
            <button
              onClick={() => setAuthOpen("login")}
              className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-body text-sm font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98]"
            >
              <SignIn size={15} weight="bold" /> Sign in
            </button>
          ) : variant === "landing" ? (
            <a
              href="/app"
              className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-body text-sm font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98]"
            >
              {balance ?? "…"} <ArrowRight size={15} weight="bold" />
            </a>
          ) : (
            <div className="relative flex items-center" ref={menuRef}>
              {/* Balance chip: DISPLAY ONLY — no sign-out on click (bug fix) */}
              <div
                className="flex items-center gap-1.5 rounded-full rounded-r-none border border-r-0 border-line bg-raised px-3.5 py-2 font-body text-xs font-semibold"
                aria-label={`Balance: ${balance ?? "loading"}`}
              >
                <Coins size={14} weight="fill" className="text-accent" />
                {balance ?? "…"}
              </div>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="flex min-h-[36px] items-center rounded-full rounded-l-none border border-line bg-raised px-2.5 py-2 text-muted transition-colors hover:text-foreground"
              >
                <CaretDown size={14} weight="bold" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-2xl border border-line bg-background"
                  style={{ boxShadow: "var(--shadow-sticker)" }}
                >
                  <div className="border-b border-line px-4 py-3">
                    <p className="font-body text-xs uppercase tracking-wide text-muted">
                      Balance
                    </p>
                    <p className="font-display text-lg font-bold">{balance ?? "…"}</p>
                  </div>
                  {variant === "app" && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/");
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 font-body text-sm font-medium text-foreground transition-colors hover:bg-raised"
                    >
                      <HouseSimple size={16} /> Back to home
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-3 font-body text-sm font-medium text-error transition-colors hover:bg-error-soft"
                  >
                    <SignOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}
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
