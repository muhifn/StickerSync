"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookmarkSimple,
  Check,
  X,
  WarningCircle,
  DownloadSimple,
  ArrowRight,
  GooglePlayLogo,
  AppStoreLogo,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { API_BASE, getToken } from "@/lib/auth";
import { dict, detectLocale, onLocaleChange, type Locale } from "@/lib/i18n";
import { Navbar } from "@/components/Navbar";

interface CrateItem {
  sticker_id: string;
  url: string;
  urls: string[];
  is_animated: boolean;
  added_at: string;
  fresh: boolean;
  owned: boolean;
}

export default function CratePage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [t, setT] = useState(dict.en.crate);
  const [items, setItems] = useState<CrateItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState<number | null>(null);
  const [showWA, setShowWA] = useState(false);

  useEffect(() => {
    const l = detectLocale();
    setLocale(l);
    setT(dict[l].crate);
    return onLocaleChange((nl) => {
      setLocale(nl);
      setT(dict[nl].crate);
    });
  }, []);

  // auth guard
  useEffect(() => {
    if (!getToken()) window.location.replace("/?signin=1");
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/crate`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        window.location.replace("/?signin=1");
        return;
      }
      const data = await res.json();
      setItems(data.stickers || []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const remove = async (id: string) => {
    await fetch(`${API_BASE}/crate/remove`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sticker_id: id, url: "" }),
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    load();
  };

  const sel = items?.filter((i) => selected.has(i.sticker_id)) ?? [];
  const selNew = sel.filter((s) => !s.owned && s.fresh).length;
  const selFree = sel.length - sel.filter((s) => !s.owned && s.fresh).length;
  const selUnfresh = sel.filter((s) => !s.fresh).length;

  const exportPack = useCallback(async () => {
    if (busy || selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/crate/export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sticker_ids: [...selected] }),
      });
      if (res.status === 402) {
        alert(await res.json().then((d) => d.detail).catch(() => "Not enough credits"));
        return;
      }
      if (!res.ok) {
        alert(await res.json().then((d) => d.detail).catch(() => "Export failed"));
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `stickersync-pack-${Date.now()}.wastickers`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setExported(selected.size);
      setShowWA(true);
      load();
    } catch {
      alert("Export failed — try again");
    } finally {
      setBusy(false);
    }
  }, [busy, selected, load]);

  return (
    <div className="relative z-[1] min-h-[100dvh]">
      <Navbar variant="app" />
      <main className="mx-auto max-w-[1200px] px-4 pb-32 pt-10 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-tag mb-2">{dict[locale].library.tag}</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
            <p className="mt-1.5 text-sm text-white/40">
              {items ? `${items.length} / 200` : "…"} · {t.capNote}
            </p>
          </div>
          <a
            href="/app"
            className="flex min-h-[38px] items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/60 transition-colors hover:border-white/30 hover:text-white"
          >
            <ArrowRight size={15} weight="bold" className="rotate-180" /> Back to hunt
          </a>
        </div>

        {/* empty state */}
        {items !== null && items.length === 0 && (
          <div className="mt-14 flex flex-col items-center gap-4 text-center">
            <BookmarkSimple size={44} weight="fill" className="text-accent" />
            <p className="max-w-[46ch] text-sm leading-relaxed text-white/50">{t.empty}</p>
            <a
              href="/app"
              className="mt-2 flex min-h-[42px] items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(254,44,85,0.4)] active:scale-95"
            >
              Start hunting <ArrowRight size={15} weight="bold" />
            </a>
          </div>
        )}

        {/* grid */}
        {items !== null && items.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((s) => {
              const isSel = selected.has(s.sticker_id);
              return (
                <article
                  key={s.sticker_id}
                  className={`die-cut relative overflow-hidden p-2 transition-all ${
                    isSel ? "ring-2 ring-accent" : ""
                  } ${!s.fresh ? "opacity-60" : ""}`}
                >
                  {!s.fresh && (
                    <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-warn-soft px-2 py-0.5 text-[10px] font-bold text-white/60">
                      <WarningCircle size={10} weight="fill" /> {t.expiredBadge}
                    </span>
                  )}
                  {s.owned && (
                    <span className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md bg-accent-2 px-2 py-0.5 text-[10px] font-bold text-accent-2-fg">
                      <Check size={10} weight="bold" /> {t.ownedBadge}
                    </span>
                  )}
                  <button
                    onClick={() => toggle(s.sticker_id)}
                    aria-pressed={isSel}
                    className="relative block aspect-square w-full overflow-hidden rounded-[16px] bg-[#0d0d0d]"
                  >
                    <img src={s.url} alt="Sticker" className="h-full w-full object-contain" loading="lazy" />
                    <span
                      className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${
                        isSel ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                        <Check size={20} weight="bold" className="text-accent-fg" />
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center justify-between px-1.5 pb-1 pt-2.5">
                    <button
                      onClick={() => remove(s.sticker_id)}
                      aria-label={t.remove}
                      className="text-white/40 transition-colors hover:text-error"
                    >
                      <X size={15} />
                    </button>
                    {!s.owned && s.fresh && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                        {t.wishlistBadge}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* floating export bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 w-[min(94vw,40rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-raised px-4 py-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                {selected.size} selected
                {selUnfresh > 0 && <span className="text-white/40"> · {selUnfresh} expired skipped</span>}
              </p>
              <p className="text-xs text-white/40">
                {selNew > 0 && (
                  <span>
                    {selNew} {t.exportCost} ({selNew} {dict[locale].pricing.free.price === "Rp 0" ? "kredit" : "credits"})
                    {" · "}
                  </span>
                )}
                {selFree} {t.exportFree}
              </p>
            </div>
            <button
              onClick={exportPack}
              disabled={busy || selNew + selFree === 0}
              className="flex min-h-[42px] shrink-0 items-center gap-2 rounded-full bg-accent-2 px-5 py-2.5 text-sm font-bold text-accent-2-fg transition-all hover:shadow-[0_0_30px_rgba(37,211,102,0.4)] active:scale-95 disabled:opacity-40"
            >
              {busy ? "…" : (
                <>
                  <WhatsappLogo size={15} weight="bold" /> {t.exportBtn}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* WA import instructions modal (after successful export) */}
      {showWA && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowWA(false)}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-white/10 bg-raised p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <span className="die-cut flex h-11 w-11 items-center justify-center">
                <DownloadSimple size={20} weight="bold" className="text-accent-2" />
              </span>
              <button onClick={() => setShowWA(false)} aria-label="Close" className="text-white/40 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <h3 className="mt-4 font-display text-xl font-extrabold tracking-tight">
              {exported} stickers → WhatsApp tray
            </h3>
            <ol className="mt-5 space-y-4">
              {[
                { icon: <GooglePlayLogo size={18} weight="fill" className="text-accent" />, text: t.waStep1 },
                { icon: <WhatsappLogo size={18} weight="fill" className="text-accent-2" />, text: t.waStep2 },
                { icon: <Check size={18} weight="bold" className="text-accent-2" />, text: t.waStep3 },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                    {step.icon}
                  </span>
                  <p className="pt-1.5 text-sm leading-relaxed text-white/70">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <a
                href="https://play.google.com/store/apps/details?id=com.marsvard.stickermakerforwhatsapp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-fg transition-transform active:scale-95"
              >
                <GooglePlayLogo size={15} weight="fill" /> Google Play
              </a>
              <a
                href="https://apps.apple.com/app/sticker-maker-studio/id1443326857"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/80 transition-colors hover:border-white/40"
              >
                <AppStoreLogo size={15} weight="fill" /> App Store
              </a>
            </div>
            <button
              onClick={() => setShowWA(false)}
              className="mt-4 w-full text-center text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              Done — packs exported before can be re-exported free
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
