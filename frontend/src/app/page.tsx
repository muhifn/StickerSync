"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Sticker as StickerIcon,
  Gift,
  Coins,
  DownloadSimple,
  SquaresFour,
  Globe,
} from "@phosphor-icons/react";
import { API_BASE, getToken, setSession, refreshBalance } from "@/lib/auth";
import { dict, detectLocale, persistLocale, type Locale } from "@/lib/i18n";
import { AuthModal } from "@/components/AuthModal";

interface Stats {
  library_size: number;
  total_downloads: number;
  world_pool: number;
}

const FloatSticker = memo(function FloatSticker() {
  return (
    <div className="float-loop relative mx-auto w-48 sm:w-64 md:w-full max-w-[340px] aspect-square">
      <div
        className="absolute inset-0 rounded-[2.5rem] rotate-[-4deg] border border-line bg-raised"
        style={{ boxShadow: "var(--shadow-sticker)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0 flex items-center justify-center rounded-[2.5rem] rotate-[2.5deg] border border-line bg-background"
        style={{ boxShadow: "var(--shadow-lift)" }}
        aria-hidden
      >
        <StickerIcon size="45%" weight="fill" className="text-accent/40" aria-label="Sticker preview" />
      </div>
      <span className="absolute -bottom-3 -left-3 rounded-full bg-accent px-3.5 py-1.5 font-body text-[11px] font-semibold tracking-wide text-accent-fg uppercase">
        Animated
      </span>
    </div>
  );
});

export default function Landing() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  const [t, setT] = useState(dict.en);
  const [stats, setStats] = useState<Stats | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  // locale init + switch
  useEffect(() => {
    const l = detectLocale();
    setLocale(l);
    setT(dict[l]);
  }, []);

  const switchLocale = (l: Locale) => {
    persistLocale(l);
    setLocale(l);
    setT(dict[l]);
  };

  // stats: fetch + 30s poll
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/stats`);
        const data = await res.json();
        if (alive) setStats(data);
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  // referral capture
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) window.localStorage.setItem("stickersync_ref", ref);
  }, []);

  // OAuth redirect handler: #token / #auth_error
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");
    const uid = params.get("uid");
    const err = params.get("auth_error");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (token && uid) {
      setSession(token, uid);
      router.push("/app");
      return;
    }
    if (err) {
      setAuthError(
        err === "denied"
          ? "Google sign-in was cancelled. Try again or use email."
          : err === "email"
          ? "We couldn't verify your Google email. Try again or use email."
          : "The sign-in session expired. Please try again."
      );
      setAuthMode("login");
    }
  }, [router]);

  // ?signin=1 → open modal
  useEffect(() => {
    const signin = new URLSearchParams(window.location.search).get("signin");
    if (signin === "1" && !getToken()) setAuthMode("login");
  }, []);

  // signed-in state (for header)
  useEffect(() => {
    const t = getToken();
    if (t) {
      setSignedIn(true);
      refreshBalance().then((b) => b && setBalance(b));
    }
  }, []);

  const onAuthSuccess = useCallback(() => {
    router.push("/app");
  }, [router]);

  const fmt = (n: number | null | undefined) =>
    n === null || n === undefined ? "…" : n.toLocaleString(locale === "id" ? "id-ID" : "en-US");

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto max-w-[1400px] px-4 md:px-10">
        <header className="flex items-center justify-between py-6">
          <a href="/" className="font-display text-lg font-bold tracking-tight">
            Sticker<span className="text-accent">Sync</span>
          </a>
          <div className="flex items-center gap-2.5">
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
            <a
              href={signedIn ? "/app" : "/app"}
              className="flex min-h-[36px] items-center gap-2 rounded-full bg-accent px-4 py-2 font-body text-sm font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98]"
            >
              {signedIn && balance ? (
                <>
                  <Coins size={16} weight="fill" /> {balance}
                </>
              ) : (
                t.nav.openApp
              )}
              <ArrowRight size={16} weight="bold" />
            </a>
          </div>
        </header>

        <section className="grid items-center gap-10 pb-14 pt-6 md:grid-cols-[3fr_2fr] md:gap-16 md:pb-24 md:pt-14">
          <div className="stagger-item" style={{ ["--index" as string]: 0 }}>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {t.hero.eyebrow}
            </p>
            <h1 className="mt-4 max-w-[16ch] font-display text-4xl font-bold leading-[1.02] tracking-tighter text-foreground md:text-6xl">
              {t.hero.title}
            </h1>
            <p className="mt-5 max-w-[52ch] font-body text-base leading-relaxed text-muted md:text-lg">
              {t.hero.subtitle}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="/app"
                className="flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-6 py-3 font-body text-base font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98]"
              >
                {t.hero.cta}
                <ArrowRight size={18} weight="bold" />
              </a>
              <a
                href="#how"
                className="flex min-h-[44px] items-center rounded-full border border-line bg-raised px-6 py-3 font-body text-base font-semibold text-foreground transition-colors hover:border-muted"
              >
                {t.hero.ctaSecondary}
              </a>
            </div>
            <p className="mt-6 flex items-center gap-1.5 font-body text-sm text-muted">
              <Gift size={16} weight="fill" className="text-accent" />
              {stats ? (
                <>
                  <span className="font-mono font-semibold text-foreground">{fmt(stats.world_pool)}</span>{" "}
                  {t.hero.poolLabel}
                </>
              ) : (
                t.hero.poolWarming
              )}
            </p>
          </div>
          <div className="hidden md:block stagger-item" style={{ ["--index" as string]: 2 }}>
            <FloatSticker />
          </div>
        </section>

        <section id="how" className="border-t border-line py-14 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{t.how.title}</h2>
          <div className="mt-8 max-w-[65ch] divide-y divide-border">
            {t.how.steps.map((step, i) => (
              <div key={i} className="flex gap-4 py-6 first:pt-0 last:pb-0 md:gap-6">
                <span className="font-display text-lg font-bold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-body text-sm leading-relaxed text-muted md:text-base">
                  <strong className="text-foreground">{step.lead}</strong> {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-14 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{t.stats.title}</h2>
          <dl className="mt-8 grid max-w-[65ch] grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="py-6 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              <dt className="flex items-center gap-1.5 font-body text-xs font-semibold uppercase tracking-wide text-muted">
                <SquaresFour size={15} weight="fill" className="text-accent" />
                {t.stats.library}
              </dt>
              <dd className="mt-2 font-display text-3xl font-bold tabular-nums md:text-4xl">
                {fmt(stats?.library_size)}
              </dd>
            </div>
            <div className="py-6 sm:px-6 sm:last:pr-0">
              <dt className="flex items-center gap-1.5 font-body text-xs font-semibold uppercase tracking-wide text-muted">
                <DownloadSimple size={15} weight="fill" className="text-accent" />
                {t.stats.downloads}
              </dt>
              <dd className="mt-2 font-display text-3xl font-bold tabular-nums md:text-4xl">
                {fmt(stats?.total_downloads)}
              </dd>
            </div>
            <div className="py-6 sm:px-6 sm:last:pr-0">
              <dt className="flex items-center gap-1.5 font-body text-xs font-semibold uppercase tracking-wide text-muted">
                <Gift size={15} weight="fill" className="text-accent" />
                {t.stats.pool}
              </dt>
              <dd className="mt-2 font-display text-3xl font-bold tabular-nums md:text-4xl">
                {fmt(stats?.world_pool)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-6 md:px-10">
          <p className="font-body text-xs text-muted">{t.footer.rights}</p>
          <p className="font-body text-xs text-muted">{t.footer.disclaimer}</p>
        </div>
      </footer>

      {authMode && (
        <AuthModal
          mode={authMode}
          onModeChange={(m) => setAuthMode(m)}
          onClose={() => {
            setAuthMode(null);
            setAuthError(null);
          }}
          onSuccess={onAuthSuccess}
        />
      )}
      {authError && !authMode && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl bg-error-soft px-4 py-3 text-center font-body text-sm font-medium text-error" style={{ boxShadow: "var(--shadow-lift)" }}>
          {authError}
        </div>
      )}
    </div>
  );
}
