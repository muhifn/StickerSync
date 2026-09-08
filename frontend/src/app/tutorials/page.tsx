"use client";

import { useEffect } from "react";
import { ArrowRight, CaretRight, BookmarkSimple, ShareFat, FilePlus } from "@phosphor-icons/react";
import { useLocale } from "@/lib/useLocale";
import { Navbar } from "@/components/Navbar";

export default function TutorialsPage() {
  const { t } = useLocale();
  const tut = t.tutorials;

  // scroll reveal — same pattern as landing (sections stay opacity:0 without this)
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



  return (
    <div className="relative z-[1] min-h-[100dvh]">
      <Navbar variant="landing" />
      <main className="mx-auto max-w-[1000px] px-5 pb-24 pt-14 md:px-10 md:pt-20">
        {/* header */}
        <p className="section-tag">{tut.tag}</p>
        <h1 className="section-h whitespace-pre-line">{tut.title}</h1>
        <p className="-mt-8 max-w-[52ch] text-base leading-relaxed text-white/50">{tut.lead}</p>

        {/* ===== T1: WA tray via Sticker Maker ===== */}
        <section className="reveal mt-16 md:mt-20">
          <div>
            <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[2px] text-accent">
              {tut.t1Tag}
            </span>
            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight md:text-3xl">{tut.t1Title}</h2>
            <ol className="mt-6 space-y-4">
              {tut.t1Steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-bold text-accent-fg">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-sm leading-relaxed text-white/70">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs leading-relaxed text-white/40">{tut.t1Note}</p>
            <a
              href="/app/crate"
              className="mt-6 inline-flex min-h-[42px] items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(254,44,85,0.4)] active:scale-95"
            >
              <BookmarkSimple size={15} weight="bold" /> {tut.t1Cta} <ArrowRight size={15} weight="bold" />
            </a>
          </div>
        </section>

        {/* ===== T2: sticker-overwrite trick ===== */}
        <section className="reveal mt-20 border-t border-white/5 pt-16 md:mt-28 md:pt-20">
          <div>
            <span className="inline-flex rounded-full bg-accent-2-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[2px] text-accent-2">
              {tut.t2Tag}
            </span>
            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight md:text-3xl">{tut.t2Title}</h2>
            <ol className="mt-6 space-y-4">
              {tut.t2Steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-2 font-mono text-xs font-bold text-accent-2-fg">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-sm leading-relaxed text-white/70">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs leading-relaxed text-white/40">{tut.t2Note}</p>
          </div>
        </section>

        {/* ===== T3: any chat (no video — icon steps) ===== */}
        <section className="reveal mt-20 border-t border-white/5 pt-16 md:mt-28 md:pt-20">
          <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[2px] text-accent">
            {tut.t3Tag}
          </span>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight md:text-3xl">{tut.t3Title}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {tut.t3Steps.map((step, i) => {
              const icons = [
                <ShareFat key="a" size={20} weight="fill" className="text-accent" />,
                <CaretRight key="b" size={20} weight="bold" className="text-accent-2" />,
                <FilePlus key="c" size={20} weight="fill" className="text-accent-purple" />,
              ];
              return (
                <div
                  key={i}
                  className="rounded-[20px] border border-white/5 bg-raised p-6 transition-all hover:-translate-y-1 hover:border-accent/20"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">{icons[i]}</span>
                  <p className="mt-4 text-sm leading-relaxed text-white/70">{step}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-white/40">{tut.t3Note}</p>
          <a
            href="/app"
            className="mt-6 inline-flex min-h-[42px] items-center gap-2 rounded-full border border-white/15 px-6 py-2.5 text-sm font-bold text-white/80 transition-colors hover:border-white/40 hover:text-white"
          >
            <ShareFat size={15} weight="bold" /> {tut.t3Cta} <ArrowRight size={15} weight="bold" />
          </a>
        </section>

        {/* back */}
        <div className="mt-16 border-t border-white/5 pt-8">
          <button
            onClick={() => window.location.assign("/")}
            className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            ← {tut.backToHunt}
          </button>
        </div>
      </main>
    </div>
  );
}
