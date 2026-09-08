"use client";

import { useEffect, useRef, useState } from "react";
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
  BookmarkSimple,
  List,
  X,
  PlayCircle,
} from "@phosphor-icons/react";
import { getToken, clearSession, refreshBalance } from "@/lib/auth";
import { persistLocale, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";

export function Navbar({ variant }: { variant: "landing" | "app" }) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [signedIn, setSignedIn] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState<"login" | "signup" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // auth snapshot + balance fetch live inside the effect as a local async —
    // state settles after await, no synchronous cascade
    (async () => {
      if (getToken()) {
        setSignedIn(true);
        setBalance(await refreshBalance());
      } else {
        setSignedIn(false);
      }
    })();
  }, []);

  // close mobile sheet on outside click / Escape (clicks inside nav/sheet keep it open)
  useEffect(() => {
    if (!mobileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMobileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // close account dropdown on outside click / Escape
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
    persistLocale(l); // store update re-renders useLocale subscribers
    setMobileOpen(false);
  };

  // HARD navigation: clears all client state + guards, guarantees full page transition.
  // (router.push("/") from /app could dedup/fail silently — this was the back-to-home bug.)
  const goHome = () => window.location.assign("/");
  const goApp = () => window.location.assign("/app");
  const openTopUp = () =>
    window.dispatchEvent(new CustomEvent("stickersync:opentopup"));

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

  const langToggle = (big = false) => (
    <div
      className={`flex items-center gap-1 rounded-full border border-white/10 ${big ? "p-1" : "p-0.5"}`}
      role="group"
      aria-label="Language"
    >
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full font-body font-semibold uppercase tracking-wide transition-colors ${
            big
              ? `min-h-[44px] flex-1 px-5 py-2 text-center text-sm ${locale === l ? "bg-white text-background" : "text-white/40 hover:text-white"}`
              : `px-2.5 py-1 text-[11px] ${locale === l ? "bg-white text-background" : "text-white/40 hover:text-white"}`
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );

  const ctaLabel = !signedIn ? t.nav.signIn : t.nav.openApp;

  return (
    <>
      <nav
        ref={navRef}
        className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl"
        style={{ background: "rgba(3,3,3,0.8)" }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:gap-4 md:px-10">
          {/* ZONE 1: logo left — button keeps the documented hard-navigation fix
              (router.push("/") from /app could dedup silently) while staying keyboard-semantic */}
          <button
            onClick={goHome}
            aria-label="StickerSync — home"
            className="group inline-flex items-center font-display text-lg font-extrabold tracking-tight md:text-xl"
          >
            Sticker
            <span className="ml-0.5 inline-block -rotate-3 rounded-md border-2 border-white/90 bg-white/5 px-1.5 py-0.5 transition-transform group-hover:rotate-0">
              <em className="not-italic text-accent">Sync</em>
            </span>
          </button>

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
              <a href="/tutorials" className="font-body text-[13px] font-medium text-white/45 transition-colors hover:text-white">
                {t.tutorials.tag}
              </a>
            </div>
          )}

          {/* ZONE 2: right cluster */}
          <div className="ml-auto flex items-center gap-2 md:gap-5">
            {variant === "app" && signedIn && (
              <>
                {/* crate + home links live inline on desktop only — mobile uses the bottom tab bar */}
                <a
                  href="/app/crate"
                  title={t.crate.title}
                  aria-label={t.crate.title}
                  className="hidden items-center gap-1.5 font-body text-[13px] font-medium text-white/45 transition-colors hover:text-white lg:flex"
                >
                  <BookmarkSimple size={14} /> {t.crate.title}
                </a>
                <button
                  onClick={goHome}
                  className="hidden items-center gap-1.5 font-body text-[13px] font-medium text-white/45 transition-colors hover:text-white lg:flex"
                >
                  <HouseSimple size={14} /> {t.nav.backHome}
                </button>
                <span className="hidden h-5 w-px bg-white/10 lg:block" aria-hidden />
              </>
            )}

            {/* Language pill: inline from tablet up, lives in the mobile sheet below */}
            <div className="hidden md:block">{langToggle()}</div>

            {/* Mobile hamburger (<lg) — landing only */}
            {variant === "landing" && (
              <button
                onClick={() => setMobileOpen((o) => !o)}
                aria-expanded={mobileOpen}
                aria-haspopup="menu"
                aria-label={t.nav.menu}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:border-white/30 hover:text-white lg:hidden"
              >
                {mobileOpen ? <X size={17} weight="bold" /> : <List size={17} weight="bold" />}
              </button>
            )}

            {/* Primary CTA — landing only (inside /app it's redundant and overflows mobile) */}
            {variant === "landing" && (
              <button
                onClick={!signedIn ? () => setAuthOpen("signup") : goApp}
                className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-2 font-body text-[12px] font-bold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(254,44,85,0.5)] active:scale-95 md:min-h-[34px] md:px-4 md:text-[13px]"
              >
                {!signedIn ? (
                  <><SignIn size={14} weight="bold" className="hidden sm:inline" /> {ctaLabel}</>
                ) : (
                  <><MagnifyingGlass size={14} weight="bold" /> {ctaLabel}</>
                )}
              </button>
            )}

            {signedIn && variant === "app" && (
              <div className="relative flex items-center gap-2" ref={menuRef}>
                <button
                  onClick={openTopUp}
                  aria-label="Top up credits"
                  title="Top up credits"
                  className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 font-body text-[12px] font-bold text-accent-fg transition-all hover:shadow-[0_0_30px_rgba(254,44,85,0.45)] active:scale-95 md:min-h-[34px]"
                >
                  <Coins size={13} weight="fill" /> +
                </button>
                {/* Balance chip: DISPLAY ONLY — no sign-out on click (bug fix).
                    Mobile shows the number only (compact); full text from md up. */}
                <div
                  className="flex min-h-[40px] items-center gap-1.5 rounded-l-full border border-r-0 border-white/10 bg-raised px-3 py-2 font-mono text-xs font-semibold text-white/80 md:min-h-[34px] md:px-3.5"
                  aria-label={`Balance: ${balance ?? "loading"}`}
                  title={balance ?? undefined}
                >
                  <Coins size={13} weight="fill" className="text-accent" />
                  <span className="md:hidden">{balance ? balance.split(" ")[0] : "…"}</span>
                  <span className="hidden md:inline">{balance ?? "…"}</span>
                </div>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                  className="flex min-h-[40px] items-center rounded-r-full border border-white/10 bg-raised px-2.5 py-2 text-white/40 transition-colors hover:text-white md:min-h-[34px]"
                >
                  <CaretDown size={13} weight="bold" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] w-60 overflow-hidden rounded-2xl border border-white/10 bg-raised shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]"
                  >
                    <div className="border-b border-white/10 px-4 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                        Balance
                      </p>
                      <p className="mt-0.5 font-display text-base font-bold">{balance ?? "…"}</p>
                    </div>
                    {/* Language row — mobile replaces the inline pill */}
                    <div className="border-b border-white/10 px-4 py-3 md:hidden">
                      <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
                        <Globe size={12} /> {t.nav.language}
                      </p>
                      {langToggle(true)}
                    </div>
                    {/* Crate row — restores mobile access lost with the bottom bar */}
                    <a
                      href="/app/crate"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 border-b border-white/10 px-4 py-3 font-body text-[13px] font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <BookmarkSimple size={15} /> {t.crate.title}
                    </a>
                    <a
                      href="/tutorials"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 border-b border-white/10 px-4 py-3 font-body text-[13px] font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <PlayCircle size={15} /> {t.tutorials.tag}
                    </a>
                    <button
                      role="menuitem"
                      onClick={goHome}
                      className="flex w-full items-center gap-2.5 border-b border-white/10 px-4 py-3 font-body text-[13px] font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <ArrowRight size={15} /> {t.nav.backHome}
                    </button>
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

        {/* Mobile sheet (<lg) — landing variant: anchor links + language row + CTA footer.
            Placed INSIDE the nav so it inherits sticky positioning (no magic top offset). */}
        {mobileOpen && variant === "landing" && (
          <div
            className="nav-sheet absolute inset-x-0 top-full z-40 border-b border-white/10 bg-[#0a0508]/97 backdrop-blur-xl lg:hidden"
            role="menu"
          >
            <div className="mx-auto max-w-[1400px] px-4 py-4 md:px-10">
              <div className="flex flex-col">
                {[
                  { href: "#how", label: t.nav.howItWorks },
                  { href: "#pricing", label: t.nav.pricing },
                  { href: "#safety", label: t.nav.safety },
                  { href: "#faq", label: t.nav.faq },
                  { href: "/tutorials", label: t.tutorials.tag },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="min-h-[48px] border-b border-white/5 py-3.5 font-body text-sm font-medium text-white/70 transition-colors last:border-0 hover:text-white"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
                  <Globe size={12} /> {t.nav.language}
                </p>
                {langToggle(true)}
              </div>
              <div className="mt-4 pb-2">
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    if (!signedIn) setAuthOpen("signup");
                    else goApp();
                  }}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-body text-sm font-bold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(254,44,85,0.5)] active:scale-95"
                >
                  {!signedIn ? (
                    <><SignIn size={15} weight="bold" /> {t.nav.signIn}</>
                  ) : (
                    <><MagnifyingGlass size={15} weight="bold" /> {t.nav.openApp}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
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
