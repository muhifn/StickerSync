"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Sticker as StickerIcon,
  Check,
  X,
  CursorClick,
  MagnifyingGlass,
  WhatsappLogo,
  ShieldCheck,
  LockSimple,
  Copyright,
} from "@phosphor-icons/react";
import { API_BASE, getToken, setSession } from "@/lib/auth";
import { dict, detectLocale, persistLocale, type Locale } from "@/lib/i18n";
import { Navbar } from "@/components/Navbar";
import { CountUp } from "@/components/CountUp";
import { ActivityFeed } from "@/components/ActivityFeed";
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
      <span className="absolute -bottom-3 -left-3 rounded-full bg-accent px-3.5 py-1.5 font-body text-[11px] font-semibold uppercase tracking-wide text-accent-fg">
        Animated
      </span>
    </div>
  );
});

const stepIcons = [CursorClick, MagnifyingGlass, WhatsappLogo];
const safetyIcons = [LockSimple, ShieldCheck, Copyright];

export default function Landing() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  const [t, setT] = useState(dict.en);
  const [stats, setStats] = useState<Stats | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const startCta = useCallback(() => {
    router.push(getToken() ? "/app" : "/?signin=1");
  }, [router]);

  const numLocale = locale === "id" ? "id-ID" : "en-US";

  return (
    <div className="min-h-[100dvh]">
      <Navbar variant="landing" />

      {/* ===== HERO ===== */}
      <div className="mx-auto max-w-[1400px] px-4 md:px-10">
        <section className="grid items-center gap-10 pb-16 pt-10 md:grid-cols-[3fr_2fr] md:gap-16 md:pb-24 md:pt-16">
          <div className="stagger-item" style={{ ["--index" as string]: 0 }}>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-1.5 font-body text-xs font-semibold text-muted">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              {t.hero.eyebrow}
            </p>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tighter text-foreground md:text-7xl">
              {t.hero.title1}
              <br />
              {t.hero.title2}
              <br />
              <span className="text-accent">{t.hero.title3}</span>
            </h1>
            <p className="mt-6 max-w-[52ch] font-body text-base leading-relaxed text-muted md:text-lg">
              {t.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={startCta}
                className="flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-6 py-3 font-body text-base font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98]"
              >
                {t.hero.cta}
                <ArrowRight size={18} weight="bold" />
              </button>
              <a
                href="#how"
                className="flex min-h-[44px] items-center rounded-full border border-line bg-raised px-6 py-3 font-body text-base font-semibold text-foreground transition-colors hover:border-muted"
              >
                {t.hero.ctaSecondary}
              </a>
            </div>
            <ul className="mt-8 grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
              {t.hero.checks.map((c) => (
                <li key={c} className="flex items-center gap-2 font-body text-sm text-muted">
                  <Check size={15} weight="bold" className="shrink-0 text-accent" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden md:block stagger-item" style={{ ["--index" as string]: 2 }}>
            <FloatSticker />
          </div>
        </section>
      </div>

      {/* ===== MARQUEE ===== */}
      <div
        className="overflow-hidden border-y border-line bg-raised py-4"
        aria-hidden
      >
        <style jsx>{`
          @keyframes marquee-scroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          .marquee-track {
            display: flex;
            width: max-content;
            animation: marquee-scroll 32s linear infinite;
          }
        `}</style>
        <div className="marquee-track">
          {[...t.marquee, ...t.marquee].map((m, i) => (
            <span
              key={i}
              className="flex items-center gap-2 whitespace-nowrap px-6 font-body text-sm font-medium text-muted"
            >
              <StickerIcon size={14} weight="fill" className="text-accent" />
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* ===== STATS + ACTIVITY FEED ===== */}
      <div className="mx-auto max-w-[1400px] px-4 md:px-10">
        <section className="grid gap-10 py-14 md:grid-cols-[3fr_2fr] md:gap-16 md:py-24">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {t.stats.title}
            </h2>
            <dl className="mt-8 grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="py-6 sm:px-6 sm:first:pl-0 sm:last:pr-0">
                <dt className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.stats.library}
                </dt>
                <dd className="mt-2 font-display text-4xl font-bold tabular-nums md:text-5xl">
                  <CountUp value={stats?.library_size ?? null} locale={numLocale} />
                </dd>
              </div>
              <div className="py-6 sm:px-6 sm:last:pr-0">
                <dt className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.stats.downloads}
                </dt>
                <dd className="mt-2 font-display text-4xl font-bold tabular-nums md:text-5xl">
                  <CountUp value={stats?.total_downloads ?? null} locale={numLocale} />
                </dd>
              </div>
              <div className="py-6 sm:px-6 sm:last:pr-0">
                <dt className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.stats.pool}
                </dt>
                <dd className="mt-2 font-display text-4xl font-bold tabular-nums md:text-5xl">
                  <CountUp value={stats?.world_pool ?? null} locale={numLocale} />
                </dd>
              </div>
            </dl>
          </div>
          <ActivityFeed />
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section id="how" className="scroll-mt-20 border-t border-line py-14 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t.how.title}
          </h2>
          <div className="mt-8 grid max-w-[65ch] divide-y divide-border">
            {t.how.steps.map((step, i) => {
              const Icon = stepIcons[i];
              return (
                <div key={i} className="flex gap-4 py-6 first:pt-0 last:pb-0 md:gap-6">
                  <span className="font-display text-lg font-bold text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="flex items-center gap-2 font-body text-base font-semibold text-foreground">
                      <Icon size={18} weight="fill" className="shrink-0 text-accent" />
                      {step.lead}
                    </p>
                    <p className="mt-1.5 max-w-[60ch] font-body text-sm leading-relaxed text-muted md:text-base">
                      {step.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== COMPARISON ===== */}
        <section className="border-t border-line py-14 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t.vs.title}
          </h2>
          <p className="mt-3 max-w-[52ch] font-body text-base leading-relaxed text-muted">
            {t.vs.lead}
          </p>
          <div className="mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
            <div
              className="rounded-[2rem] border border-accent/40 bg-accent-soft/50 p-6 md:p-7"
              style={{ boxShadow: "var(--shadow-lift)" }}
            >
              <p className="font-display text-lg font-bold tracking-tight text-foreground">
                {t.vs.us}
              </p>
              <ul className="mt-4 space-y-3">
                {t.vs.usItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 font-body text-sm text-foreground">
                    <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[2rem] border border-line bg-raised p-6 md:p-7">
              <p className="font-display text-lg font-bold tracking-tight text-muted">
                {t.vs.them}
              </p>
              <ul className="mt-4 space-y-3">
                {t.vs.themItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 font-body text-sm text-muted">
                    <X size={16} weight="bold" className="mt-0.5 shrink-0 text-muted/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ===== PRICING ===== */}
        <section id="pricing" className="scroll-mt-20 border-t border-line py-14 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t.pricing.title}
          </h2>
          <p className="mt-3 max-w-[52ch] font-body text-base leading-relaxed text-muted">
            {t.pricing.lead}
          </p>
          <div className="mt-8 grid max-w-4xl gap-4 md:grid-cols-3">
            {/* Free */}
            <div
              className="flex flex-col rounded-[2rem] border border-line bg-raised p-6"
              style={{ boxShadow: "var(--shadow-lift)" }}
            >
              <p className="font-display text-lg font-bold tracking-tight">{t.pricing.free.name}</p>
              <p className="mt-2 font-display text-4xl font-bold tracking-tighter">
                {t.pricing.free.price}
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                {t.pricing.free.desc}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {t.pricing.free.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 font-body text-sm text-foreground">
                    <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={startCta}
                className="mt-6 flex min-h-[44px] items-center justify-center rounded-full bg-accent px-5 py-3 font-body text-sm font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98]"
              >
                {t.pricing.free.cta}
              </button>
            </div>

            {/* Starter — soon */}
            <div
              className="relative flex flex-col rounded-[2rem] border border-line bg-raised p-6"
              style={{ boxShadow: "var(--shadow-lift)" }}
            >
              <span className="absolute right-5 top-5 rounded-full bg-warn-soft px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
                {t.pricing.soon}
              </span>
              <p className="font-display text-lg font-bold tracking-tight">{t.pricing.starter.name}</p>
              <p className="mt-2 font-display text-4xl font-bold tracking-tighter">
                {t.pricing.starter.price}
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                {t.pricing.starter.desc}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {t.pricing.starter.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 font-body text-sm text-foreground">
                    <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                disabled
                className="mt-6 flex min-h-[44px] cursor-not-allowed items-center justify-center rounded-full border border-line bg-background px-5 py-3 font-body text-sm font-semibold text-muted opacity-60"
              >
                {t.pricing.starter.cta}
              </button>
            </div>

            {/* Bundle — soon */}
            <div
              className="relative flex flex-col rounded-[2rem] border border-accent/50 bg-accent-soft/40 p-6"
              style={{ boxShadow: "var(--shadow-sticker)" }}
            >
              <span className="absolute right-5 top-5 rounded-full bg-accent px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-wide text-accent-fg">
                {t.pricing.popular}
              </span>
              <span className="absolute right-5 top-10 mt-4 rounded-full bg-warn-soft px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
                {t.pricing.soon}
              </span>
              <p className="font-display text-lg font-bold tracking-tight">{t.pricing.bundle.name}</p>
              <p className="mt-2 font-display text-4xl font-bold tracking-tighter">
                {t.pricing.bundle.price}
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                {t.pricing.bundle.desc}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {t.pricing.bundle.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 font-body text-sm text-foreground">
                    <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                disabled
                className="mt-6 flex min-h-[44px] cursor-not-allowed items-center justify-center rounded-full border border-line bg-background px-5 py-3 font-body text-sm font-semibold text-muted opacity-60"
              >
                {t.pricing.bundle.cta}
              </button>
            </div>
          </div>
          <p className="mt-6 font-body text-sm text-muted">{t.pricing.note}</p>
        </section>

        {/* ===== SAFETY ===== */}
        <section className="border-t border-line py-14 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t.safety.title}
          </h2>
          <p className="mt-3 max-w-[52ch] font-body text-base leading-relaxed text-muted">
            {t.safety.lead}
          </p>
          <div className="mt-8 grid max-w-4xl gap-4 md:grid-cols-3">
            {t.safety.items.map((item, i) => {
              const Icon = safetyIcons[i];
              return (
                <div key={item.title} className="rounded-[2rem] border border-line bg-raised p-6">
                  <Icon size={26} weight="fill" className="text-accent" />
                  <p className="mt-3 font-body text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="scroll-mt-20 border-t border-line py-14 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t.faq.title}
          </h2>
          <div className="mt-8 max-w-[65ch] divide-y divide-border">
            {t.faq.items.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-body text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <CaretDownHandle />
                </summary>
                <p className="mt-3 max-w-[60ch] font-body text-sm leading-relaxed text-muted">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ===== FINAL CTA ===== */}
        <section className="border-t border-line py-16 text-center md:py-24">
          <h2 className="mx-auto max-w-[20ch] font-display text-3xl font-bold leading-tight tracking-tighter md:text-5xl">
            {t.finalCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] font-body text-base leading-relaxed text-muted">
            {t.finalCta.subtitle}
          </p>
          <button
            onClick={startCta}
            className="mx-auto mt-8 flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-body text-base font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98]"
          >
            {t.finalCta.button}
            <ArrowRight size={18} weight="bold" />
          </button>
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
          onSuccess={() => router.push("/app")}
        />
      )}
      {authError && !authMode && (
        <div
          className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl bg-error-soft px-4 py-3 text-center font-body text-sm font-medium text-error"
          style={{ boxShadow: "var(--shadow-lift)" }}
        >
          {authError}
        </div>
      )}
    </div>
  );
}

function CaretDownHandle() {
  return (
    <span className="shrink-0 text-muted transition-transform duration-300 group-open:rotate-180 motion-safe:transition-transform">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
