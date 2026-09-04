"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Eye, DownloadSimple, ArrowRight } from "@phosphor-icons/react";
import { API_BASE } from "@/lib/auth";
import { dict, detectLocale, type Locale } from "@/lib/i18n";

export interface TrendingSticker {
  sticker_id: string;
  comment_text: string;
  author_uid: string;
  url: string;
  is_animated: boolean;
  download_count: number;
  view_count: number;
  views_72h: number;
  downloads_72h: number;
  score: number;
}

/** Fire-and-forget view ping — once per sticker per component session. */
export function useViewPing() {
  const seen = useRef<Set<string>>(new Set());
  return (stickerId: string) => {
    if (!stickerId || seen.current.has(stickerId)) return;
    seen.current.add(stickerId);
    fetch(`${API_BASE}/view/${stickerId}`, { method: "POST" }).catch(() => {});
  };
}

const Card = memo(function Card({
  s,
  onView,
  cta,
  rank,
}: {
  s: TrendingSticker;
  onView: (id: string) => void;
  cta: string;
  rank: number | null;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const pinged = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !pinged.current) {
          pinged.current = true;
          onView(s.sticker_id);
          ob.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [s.sticker_id, onView]);

  return (
    <a
      ref={ref}
      href="#signup"
      onClick={(e) => {
        e.preventDefault();
        window.location.assign("/?signin=1");
      }}
      className={`die-cut group relative block ${rank ? (rank === 1 ? "-rotate-2" : rank === 2 ? "rotate-1" : "-rotate-1") : ""} transition-transform hover:rotate-0 hover:-translate-y-1`}
    >
      {rank !== null && (
        <span className={`absolute left-2.5 top-2.5 z-10 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
          rank === 1 ? "bg-accent text-accent-fg" : rank === 2 ? "bg-white text-background" : "bg-accent-2 text-accent-2-fg"
        }`}>
          #{rank}
        </span>
      )}
      <div className="relative aspect-square overflow-hidden bg-[#0d0d0d]">
        <img
          src={s.url}
          alt={`Sticker by @${s.author_uid}`}
          className="h-full w-full object-contain"
          loading="lazy"
        />
        {s.is_animated && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70 backdrop-blur">
            Animated
          </span>
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg">
            {cta} <ArrowRight size={14} weight="bold" />
          </span>
        </span>
      </div>
      <div className="p-3.5">
        {s.comment_text && (
          <p className="truncate text-xs text-white/50">&ldquo;{s.comment_text}&rdquo;</p>
        )}
        <p className="mt-0.5 truncate text-sm font-semibold text-white/85">@{s.author_uid}</p>
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <Eye size={12} weight="bold" className="text-accent" />
            {s.views_72h > 0 ? s.views_72h.toLocaleString() : s.view_count.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <DownloadSimple size={12} weight="bold" className="text-accent" />
            {s.downloads_72h > 0 ? s.downloads_72h.toLocaleString() : s.download_count.toLocaleString()}
          </span>
        </div>
      </div>
    </a>
  );
});

/** Landing "Live watch" section: trending stickers grid (views+downloads 72h). */
export const TrendingStrip = memo(function TrendingStrip() {
  const [stickers, setStickers] = useState<TrendingSticker[] | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const t = dict[locale].trending;
  const onView = useViewPing();

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/trending`);
        const data = await res.json();
        if (alive) setStickers(data.stickers || []);
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (stickers !== null && stickers.length === 0) return null;

  return (
    <section className="reveal pb-24 md:pb-28">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <p className="section-tag mb-0">{t.tag}</p>
      </div>
      <h2 className="section-h">{t.title}</h2>
      <p className="-mt-8 max-w-[52ch] text-base leading-relaxed text-white/50">{t.lead}</p>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {(stickers ?? Array.from({ length: 8 }, () => null)).map((s, i) =>
          s ? (
            <Card key={s.sticker_id} s={s} onView={onView} cta={t.cta} rank={i < 3 ? i + 1 : null} />
          ) : (
            <div key={i} className="die-cut overflow-hidden" aria-hidden>
              <div className="skeleton aspect-square" />
              <div className="p-3.5">
                <div className="skeleton h-3 w-3/4 rounded-full" />
                <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
});
