"use client";

import { memo, useCallback, useEffect, useState } from "react";
import {
  MagnifyingGlass,
  Check,
  Eye,
  ArrowLeft,
  ArrowRight,
  Funnel,
  ShareFat,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { API_BASE } from "@/lib/auth";
import { dict, detectLocale, onLocaleChange, type Locale } from "@/lib/i18n";
import { useViewPing, type TrendingSticker } from "@/components/TrendingStrip";
import { CrateButton } from "@/components/CrateButton";

interface LibRow extends TrendingSticker {
  created_at: string;
}

type Sort = "trending" | "recent" | "downloads";

export const LibraryBrowse = memo(function LibraryBrowse({ onDownload }: { onDownload: (s: LibRow, fmt: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("trending");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [rows, setRows] = useState<LibRow[] | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const t = dict[locale].library;
  const onView = useViewPing();

  useEffect(() => {
    setLocale(detectLocale());
    return onLocaleChange((l) => setLocale(l));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/library?q=${encodeURIComponent(q)}&sort=${sort}&page=${page}&per_page=24`
      );
      const data = await res.json();
      setRows(data.stickers || []);
      setPages(data.pages || 1);
    } catch {
      setRows([]);
    }
  }, [q, sort, page]);

  useEffect(() => {
    const id = window.setTimeout(load, 250); // debounce search
    return () => window.clearTimeout(id);
  }, [load]);

  const sortLabels: Record<Sort, string> = {
    trending: t.sortTrending,
    recent: t.sortRecent,
    downloads: t.sortDownloads,
  };

  return (
    <section className="reveal border-t border-white/5 pt-14 md:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-tag mb-2">{t.tag}</p>
          <h2 className="font-display text-2xl font-black tracking-tight md:text-3xl">{t.title}</h2>
        </div>
        {/* sort pills */}
        <div className="flex items-center gap-1 rounded-full border border-white/10 p-1">
          <Funnel size={13} className="ml-2 text-white/40" aria-hidden />
          {(Object.keys(sortLabels) as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSort(s);
                setPage(1);
              }}
              aria-pressed={sort === s}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                sort === s ? "bg-accent text-accent-fg" : "text-white/40 hover:text-white"
              }`}
            >
              {sortLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* search */}
      <div className="relative mt-6 max-w-md">
        <MagnifyingGlass size={17} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t.searchPlaceholder}
          className="w-full rounded-full border border-white/10 bg-raised py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus-visible:border-accent"
        />
      </div>

      {/* grid */}
      {rows === null ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="die-cut overflow-hidden" aria-hidden>
              <div className="skeleton aspect-square" />
              <div className="p-3.5">
                <div className="skeleton h-3 w-3/4 rounded-full" />
                <div className="skeleton mt-2 h-8 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-10 text-sm text-white/40">{t.empty}</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((s) => (
            <article
              key={s.sticker_id}
              className="die-cut sticker-card group overflow-hidden transition-all hover:-translate-y-1"
              onMouseEnter={() => onView(s.sticker_id)}
            >
              <div className="relative aspect-square bg-background">
                <CrateButton stickerId={s.sticker_id} url={s.url} className="absolute right-2.5 top-2.5 z-10" />
                <img
                  src={s.url}
                  alt="Sticker"
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
                {s.is_animated && (
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70 backdrop-blur">
                    Animated
                  </span>
                )}
                <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-white/60 backdrop-blur">
                  <Eye size={10} weight="bold" className="text-accent" />
                  {s.view_count.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5">
                <div className="mt-3 flex gap-1.5">
                  <button
                    onClick={() => onDownload(s, "webp")}
                    className="flex min-h-[38px] flex-[2] items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2 text-xs font-bold text-accent-fg transition-all hover:shadow-[0_0_30px_rgba(254,44,85,0.45)] active:scale-95"
                  >
                    <ShareFat size={14} weight="bold" /> {t.get}
                  </button>
                  <button
                    onClick={() => onDownload(s, "wastickers")}
                    title="WhatsApp tray import (.wastickers)"
                    className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full bg-accent-2 px-3 py-2 text-xs font-bold text-accent-2-fg transition-transform active:scale-95"
                  >
                    <WhatsappLogo size={14} weight="bold" /> {t.waBtn}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* pagination */}
      {pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:opacity-30"
            aria-label="Previous page"
          >
            <ArrowLeft size={15} weight="bold" />
          </button>
          <p className="font-mono text-xs text-white/50">
            {page} / {pages}
          </p>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:opacity-30"
            aria-label="Next page"
          >
            <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      )}
    </section>
  );
});
