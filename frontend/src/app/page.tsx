"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  X,
  CursorClick,
  MagnifyingGlass,
  WhatsappLogo,
  LockSimple,
  ShieldCheck,
  Copyright,
  Sparkle,
} from "@phosphor-icons/react";
import { API_BASE, getToken, setSession } from "@/lib/auth";
import { dict, detectLocale, persistLocale, type Locale } from "@/lib/i18n";
import { Navbar } from "@/components/Navbar";
import { CountUp } from "@/components/CountUp";
import { ActivityFeed } from "@/components/ActivityFeed";
import { TrendingStrip } from "@/components/TrendingStrip";
import { AuthModal } from "@/components/AuthModal";

interface Stats {
  library_size: number;
  total_downloads: number;
  world_pool: number;
}

const stepIcons = [CursorClick, MagnifyingGlass, WhatsappLogo];
const safetyIcons = [LockSimple, ShieldCheck, Copyright];

const SectionHead = memo(function SectionHead({ tag, title }: { tag: string; title: string }) {
  return (
    <>
      <p className="section-tag">{tag}</p>
      <h2 className="section-h whitespace-pre-line">{title}</h2>
    </>
  );
});

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

  // Scroll reveal (GoClip .r pattern): sections fade+slide in on viewport entry
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    const ob = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            ob.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    els.forEach((el) => ob.observe(el));
    return () => ob.disconnect();
  }, []);

  const startCta = useCallback(() => {
    router.push(getToken() ? "/app" : "/?signin=1");
  }, [router]);

  const numLocale = locale === "id" ? "id-ID" : "en-US";

  return (
    <div className="min-h-[100dvh]">
      <Navbar variant="landing" />

      {/* ===== HERO (centered, GoClip-style) ===== */}
      <section className="relative flex min-h-[92dvh] flex-col items-center justify-center px-5 pb-20 pt-28 text-center">
        <p className="inline-flex items-center gap-2 rounded-full font-body text-[11px] font-bold uppercase tracking-[2.5px] text-accent">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          {t.hero.eyebrow}
        </p>
        <h1
          className="mt-9 font-display font-black leading-[0.95] tracking-[-0.045em]"
          style={{ fontSize: "clamp(56px, 9vw, 120px)" }}
        >
          <span className="glitch-loop block">{t.hero.title1}</span>
          <span className="block text-accent">{t.hero.title2}</span>
          <span className="block">{t.hero.title3}</span>
        </h1>
        <p className="mt-8 max-w-[560px] font-body text-base leading-[1.65] text-white/50 md:text-lg">
          {t.hero.subtitle}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={startCta}
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-10 py-4 font-body text-base font-extrabold tracking-tight text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(0,255,136,0.5)] active:scale-95"
          >
            {t.hero.cta} <ArrowRight size={18} weight="bold" />
          </button>
          <a
            href="#how"
            className="flex min-h-[44px] items-center rounded-full border border-white/15 px-8 py-4 font-body text-[15px] font-semibold text-white/50 transition-colors hover:border-white/30 hover:text-white"
          >
            {t.hero.ctaSecondary}
          </a>
        </div>
        {/* trust row — one line, dot-separated (GoClip pattern) */}
        <ul className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {t.hero.checks.map((c, i) => (
            <li key={c} className="flex items-center gap-8">
              <span className="flex items-center gap-2 font-body text-[13px] font-medium text-white/35">
                <Check size={14} weight="bold" className="text-accent" /> {c}
              </span>
              {i < t.hero.checks.length - 1 && (
                <span className="hidden h-1 w-1 rounded-full bg-white/15 sm:block" aria-hidden />
              )}
            </li>
          ))}
        </ul>
        {/* info banner */}
        <div className="mt-8 flex max-w-[560px] flex-wrap items-center justify-center gap-x-2 rounded-xl border border-accent-line bg-accent-soft px-5 py-3 text-center font-body text-[13px] text-white/55">
          {t.hero.note}{" "}
          <a href="#safety" className="font-semibold text-accent transition-opacity hover:opacity-80">
            {t.hero.noteLink}
          </a>
        </div>
      </section>

      {/* ===== MARQUEE ===== */}
      <div className="overflow-hidden border-y border-white/5 bg-raised py-3.5" aria-hidden>
        <div
          className="flex w-max gap-12 whitespace-nowrap"
          style={{ animation: "marq 22s linear infinite" }}
        >
          {[...t.marquee, ...t.marquee].map((m, i) => (
            <span
              key={i}
              className="flex items-center gap-3 font-body text-xs font-bold uppercase tracking-[2px] text-white/30"
            >
              <Sparkle size={12} weight="fill" className="text-accent" />
              {m}
            </span>
          ))}
        </div>
      </div>

      <main className="relative z-[1] mx-auto max-w-[1200px] px-5 md:px-10">
        {/* ===== BENTO STATS (7 cells, GoClip 4×2) ===== */}
        <section className="reveal py-24 md:py-28">
          <SectionHead tag={t.statsTag} title={t.stats.title} />
          <div className="segmented grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* WIDE: library count (span 2) */}
            <div className="flex flex-col justify-center p-9 sm:col-span-2 md:p-10">
              <p className="font-display text-6xl font-black tracking-[-3px] text-accent md:text-[64px]">
                <CountUp value={stats?.library_size ?? null} duration={1600} locale={numLocale} />
              </p>
              <p className="mt-2 text-sm font-bold text-white/85">{t.stats.library}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/40">{t.stats.librarySub}</p>
            </div>

            {/* downloads */}
            <div className="flex flex-col justify-center p-9 md:p-10">
              <p className="font-display text-6xl font-black tracking-[-3px] text-accent md:text-[64px]">
                <CountUp value={stats?.total_downloads ?? null} duration={1600} locale={numLocale} />
              </p>
              <p className="mt-2 text-sm font-bold text-white/85">{t.stats.downloads}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/40">{t.stats.downloadsSub}</p>
            </div>

            {/* world pool */}
            <div className="flex flex-col justify-center p-9 md:p-10">
              <p className="font-display text-6xl font-black tracking-[-3px] text-accent md:text-[64px]">
                <CountUp value={stats?.world_pool ?? null} duration={1600} locale={numLocale} />
              </p>
              <p className="mt-2 text-sm font-bold text-white/85">{t.stats.pool}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/40">{t.stats.poolSub}</p>
            </div>

            {/* QUALITY SCORE — 4 progress bars (GoClip AI Quality Score cell) */}
            <div className="flex flex-col justify-center p-9 md:p-10">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                </span>
                <p className="font-body text-[11px] font-bold uppercase tracking-[2px] text-accent">
                  {t.bento.qualityTag}
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {t.bento.qualityRows.map((row) => {
                  const num = parseInt(row.score, 10);
                  const bad = num <= 3;
                  return (
                    <div key={row.label}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-white/50">{row.label}</span>
                        <span className={`text-xs font-bold ${bad ? "text-[#ff6060]" : "text-accent"}`}>
                          {row.score}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${bad ? "bg-[#ff6060]" : "bg-accent"}`}
                          style={{ width: `${num * 10}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-white/25">{t.bento.qualitySub}</p>
            </div>

            {/* $0 TO START + badge */}
            <div className="flex flex-col justify-center p-9 md:p-10">
              <p className="font-display text-5xl font-black tracking-[-3px]">{t.bento.startTitle}</p>
              <p className="mt-2 text-sm font-bold text-white/85">{t.bento.startTag}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/40">{t.bento.startBody}</p>
              <span className="mt-3 inline-flex w-fit rounded-full bg-accent-soft px-3 py-1 font-body text-[11px] font-bold text-accent">
                {t.bento.startBadge}
              </span>
            </div>

            {/* USERNAME FILTER demo (mono) */}
            <div className="flex flex-col justify-center p-9 md:p-10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft">
                  <MagnifyingGlass size={15} weight="bold" className="text-accent" />
                </span>
                <p className="font-body text-[12px] font-bold uppercase tracking-[1.5px] text-accent">
                  {t.bento.filterTag}
                </p>
              </div>
              <p className="mt-4 font-display text-xl font-extrabold tracking-tight">
                {t.bento.filterTitle}
              </p>
              <p className="mt-3 rounded-lg border border-white/10 bg-background p-3 font-mono text-xs text-white/60">
                {t.bento.filterLine1}
                <br />
                <span className="text-accent">{t.bento.filterLine2}</span>
              </p>
            </div>

            {/* UP IN MINUTES — 3 mini steps */}
            <div className="flex flex-col justify-center p-9 md:p-10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
                  <CursorClick size={16} weight="fill" className="text-accent" />
                </span>
                <p className="font-body text-[13px] font-bold uppercase tracking-[1px] text-accent">
                  {t.bento.quickTag}
                </p>
              </div>
              <div className="mt-5 flex flex-col gap-2.5">
                {t.bento.quickSteps.map((s, i) => (
                  <div key={s} className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-bold text-accent-fg">
                        {i + 1}
                      </span>
                      <p className="text-[13px] text-white/60">{s}</p>
                    </div>
                    {i < t.bento.quickSteps.length - 1 && (
                      <span className="ml-3 h-3 w-px bg-white/10" aria-hidden />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== LIVE WATCH — TRENDING (after bento) ===== */}
        <TrendingStrip />

        {/* ===== HOW IT WORKS ===== */}
        <section id="how" className="reveal scroll-mt-20 pb-24 md:pb-28">
          <SectionHead tag={t.howTag} title={t.how.title} />
          <div className="segmented grid-cols-1 md:grid-cols-3">
            {t.how.steps.map((step, i) => {
              const Icon = stepIcons[i];
              return (
                <div key={i} className="group relative overflow-hidden p-12 transition-colors md:p-14">
                  <span
                    className="pointer-events-none absolute right-6 top-4 font-display text-[100px] font-black leading-none tracking-[-5px] text-accent opacity-[0.06] transition-opacity group-hover:opacity-[0.12]"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft transition-colors group-hover:bg-[rgba(0,255,136,0.18)]">
                    <Icon size={26} weight="fill" className="text-accent" />
                  </span>
                  <p className="mt-7 font-display text-2xl font-extrabold tracking-tight">
                    {step.lead}
                  </p>
                  <p className="mt-3 text-[15px] leading-[1.7] text-white/45">{step.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== LIVE TERMINAL (after how, GoClip order) ===== */}
        <section className="reveal pb-24 md:pb-28">
          <div className="mx-auto max-w-[820px]">
            <ActivityFeed />
          </div>
        </section>

        {/* ===== COMPARISON ===== */}
        <section className="reveal pb-24 md:pb-28">
          <SectionHead tag={t.vsTag} title={t.vs.title} />
          <p className="-mt-8 max-w-[52ch] text-base leading-relaxed text-white/50">{t.vs.lead}</p>
          <div className="segmented mt-12 grid-cols-1 md:grid-cols-2">
            <div className="p-10">
              <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[2px] text-accent">
                {t.vs.us}
              </span>
              <ul className="mt-7 space-y-4">
                {t.vs.usItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-white/85">
                    <Check size={17} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-10">
              <span className="inline-flex rounded-full bg-white/5 px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[2px] text-white/40">
                {t.vs.them}
              </span>
              <ul className="mt-7 space-y-4">
                {t.vs.themItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-white/40">
                    <X size={17} weight="bold" className="mt-0.5 shrink-0 text-white/25" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ===== PRICING ===== */}
        <section id="pricing" className="reveal scroll-mt-20 pb-24 text-center md:pb-28">
          <SectionHead tag={t.pricingTag} title={t.pricing.title} />
          <p className="-mt-8 mx-auto max-w-[480px] text-[17px] leading-relaxed text-white/40">
            {t.pricing.lead}
          </p>

          {/* founder pricing pill (GoClip purple pill) */}
          <div className="mx-auto mt-7 inline-flex items-center gap-2.5 rounded-full border border-[rgba(192,132,252,0.3)] bg-[rgba(192,132,252,0.08)] px-5 py-2.5">
            <Sparkle size={14} weight="fill" className="text-accent-purple" />
            <span className="font-mono text-xs font-semibold tracking-wide text-accent-purple">
              {t.pricing.founderNote}
            </span>
          </div>
          <p className="mx-auto mt-3.5 max-w-[520px] text-[13px] leading-[1.6] text-white/40">
            {t.pricing.founderSub}
          </p>

          {/* referral code hint pill (GoClip creator-code) */}
          <div className="mx-auto mt-3.5 inline-flex items-center gap-2.5 rounded-full border border-accent-line bg-accent-soft px-4.5 py-2 font-mono text-xs font-semibold text-accent">
            <span className="rounded-md bg-[rgba(0,255,136,0.18)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1.5px]">
              {t.pricing.codeTag}
            </span>
            {t.pricing.codeHint}
          </div>

          <div className="segmented mt-12 grid-cols-1 text-left md:grid-cols-3">
            {/* Free */}
            <div className="flex flex-col p-9 md:p-10">
              <p className="font-body text-xs font-bold uppercase tracking-[2px] text-white/40">
                {t.pricing.free.name}
              </p>
              <p className="mt-5 font-display text-5xl font-black tracking-[-3px]">
                {t.pricing.free.price}
                {t.pricing.free.priceUnit && (
                  <span className="font-body text-base font-medium text-white/40">{t.pricing.free.priceUnit}</span>
                )}
              </p>
              <p className="mt-4 border-b border-white/5 pb-7 text-sm leading-relaxed text-white/40">
                {t.pricing.free.desc}
              </p>
              <ul className="mt-7 flex-1 space-y-3">
                {t.pricing.free.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/85">
                    <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={startCta}
                className="mt-9 block w-full rounded-full bg-accent px-5 py-3.5 font-body text-[15px] font-extrabold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(0,255,136,0.5)] active:scale-95"
              >
                {t.pricing.free.cta}
              </button>
            </div>

            {/* Starter — soon */}
            <div className="relative flex flex-col p-9 md:p-10">
              <span className="absolute right-5 top-5 rounded-md bg-warn-soft px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-[1.5px] text-white/50">
                {t.pricing.soon}
              </span>
              <p className="font-body text-xs font-bold uppercase tracking-[2px] text-white/40">
                {t.pricing.starter.name}
              </p>
              <p className="mt-5 font-display text-5xl font-black tracking-[-3px]">
                {t.pricing.starter.price}
              </p>
              <p className="mt-4 border-b border-white/5 pb-7 text-sm leading-relaxed text-white/40">
                {t.pricing.starter.desc}
              </p>
              <ul className="mt-7 flex-1 space-y-3">
                {t.pricing.starter.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/85">
                    <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                disabled
                className="mt-9 block w-full cursor-not-allowed rounded-full border border-white/10 bg-background px-5 py-3.5 font-body text-[15px] font-extrabold text-white/30"
              >
                {t.pricing.starter.cta}
              </button>
            </div>

            {/* Bundle — soon, popular */}
            <div className="relative flex flex-col bg-[#07120c] p-9 ring-1 ring-inset ring-accent/25 md:p-10">
              <span className="absolute right-5 top-5 rounded-md bg-accent px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-[1.5px] text-accent-fg">
                {t.pricing.popular}
              </span>
              <span className="absolute right-5 top-11 mt-3 rounded-md bg-warn-soft px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-[1.5px] text-white/50">
                {t.pricing.soon}
              </span>
              <p className="font-body text-xs font-bold uppercase tracking-[2px] text-white/40">
                {t.pricing.bundle.name}
              </p>
              <p className="mt-5 font-display text-5xl font-black tracking-[-3px]">
                {t.pricing.bundle.price}
              </p>
              <p className="mt-4 border-b border-white/5 pb-7 text-sm leading-relaxed text-white/40">
                {t.pricing.bundle.desc}
              </p>
              <ul className="mt-7 flex-1 space-y-3">
                {t.pricing.bundle.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/85">
                    <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                disabled
                className="mt-9 block w-full cursor-not-allowed rounded-full border border-white/10 bg-background px-5 py-3.5 font-body text-[15px] font-extrabold text-white/30"
              >
                {t.pricing.bundle.cta}
              </button>
            </div>
          </div>
          <p className="mt-6 text-center text-[13px] text-white/40">{t.pricing.note}</p>
        </section>

        {/* ===== SAFETY ===== */}
        <section id="safety" className="reveal scroll-mt-20 pb-24 md:pb-28">
          <SectionHead tag={t.safetyTag} title={t.safety.title} />
          <p className="-mt-8 max-w-[52ch] text-base leading-relaxed text-white/50">{t.safety.lead}</p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {t.safety.items.map((item, i) => {
              const Icon = safetyIcons[i];
              return (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-white/5 bg-raised p-8 transition-all hover:-translate-y-1 hover:border-accent/20"
                >
                  <span className="inline-flex rounded-full bg-accent-soft px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[2px] text-accent">
                    {item.step}
                  </span>
                  <Icon size={26} weight="fill" className="mt-5 text-accent" />
                  <p className="mt-4 font-display text-xl font-extrabold tracking-tight">{item.title}</p>
                  <p className="mt-3 text-sm leading-[1.7] text-white/45">{item.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="reveal scroll-mt-20 pb-24 md:pb-28">
          <SectionHead tag={t.faqTag} title={t.faq.title} />
          <div className="mx-auto max-w-[720px]">
            {t.faq.items.map((item) => (
              <details key={item.q} className="group border-b border-white/5 py-7">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-body text-[17px] font-bold tracking-tight text-white [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <CaretDownHandle />
                </summary>
                <p className="mt-4 max-w-[60ch] text-[15px] leading-[1.8] text-white/45">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* ===== FINAL CTA — big green box (GoClip pattern) ===== */}
      <div className="reveal relative z-[1] px-5 pb-8 md:px-10">
        <section className="relative overflow-hidden rounded-[28px] bg-accent">
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display text-[clamp(80px,18vw,240px)] font-black tracking-[-0.05em] text-black/5"
            aria-hidden
          >
            STICKERSYNC
          </span>
          <div className="relative px-6 py-20 text-center md:py-24">
            <h2 className="mx-auto max-w-[20ch] font-display text-4xl font-black leading-[0.95] tracking-[-0.04em] text-black md:text-[clamp(40px,7vw,88px)]">
              {t.finalCta.title}
            </h2>
            <p className="mx-auto mt-5 max-w-[34ch] text-base leading-relaxed text-black/50 md:text-lg">
              {t.finalCta.subtitle}
            </p>
            <button
              onClick={startCta}
              className="mx-auto mt-9 flex min-h-[52px] items-center gap-2 rounded-full bg-black px-12 py-4 font-body text-lg font-extrabold tracking-tight text-white transition-transform hover:scale-105 active:scale-95"
            >
              {t.finalCta.button} <ArrowRight size={18} weight="bold" />
            </button>
            <p className="mt-4 text-[13px] text-black/40">{t.finalCta.note}</p>
          </div>
        </section>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-[1] border-t border-white/5">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 md:px-10">
          <p className="font-display text-lg font-black tracking-tight">
            Sticker<em className="not-italic text-accent">Sync</em>
          </p>
          <div className="flex items-center gap-4">
            <a href="#how" className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.nav.howItWorks}
            </a>
            <a href="#pricing" className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.nav.pricing}
            </a>
            <a href="#faq" className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.nav.faq}
            </a>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-5 pb-8 md:px-10">
          <p className="text-xs text-white/35">{t.footer.rights}</p>
          <p className="text-xs text-white/35">{t.footer.disclaimer}</p>
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
          className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl bg-[#1a0d0d] px-4 py-3 text-center font-body text-sm font-medium text-error"
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
    <span className="shrink-0 text-white/40 transition-transform duration-300 group-open:rotate-180 motion-safe:transition-transform">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
