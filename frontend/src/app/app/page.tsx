"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MagnifyingGlass,
  Link as LinkIcon,
  WarningCircle,
  Sticker as StickerIcon,
  Check,
  Coins,
  ShareFat,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import { API_BASE, getToken, clearSession, refreshBalance } from "@/lib/auth";
import { dict, detectLocale, type Locale } from "@/lib/i18n";
import { AuthModal } from "@/components/AuthModal";
import { Navbar } from "@/components/Navbar";
import { LibraryBrowse } from "@/components/LibraryBrowse";

interface Sticker {
  id: string;
  name: string;
  width: number;
  height: number;
  is_animated: boolean;
  url: string;
}

interface FetchResult {
  video_id: string;
  total_comments: number;
  stickers_found: number;
  stickers: Sticker[];
  message?: string;
  detail?: string;
}

function StickerSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-[20px] border border-white/5 bg-raised p-3" aria-hidden>
          <div className="skeleton aspect-square rounded-[1.4rem]" />
          <div className="skeleton mt-3 h-3.5 w-3/4 rounded-full" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
          <div className="skeleton mt-4 h-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function AppPage() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => setLocale(detectLocale()), []);
  const lib = dict[locale].library;
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [, setBalance] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);

  const refreshBalanceState = useCallback(async () => {
    const b = await refreshBalance();
    setBalance(b);
  }, []);

  // AUTH GUARD: no token -> hard redirect to landing with signin (no client-router loop)
  useEffect(() => {
    if (!getToken()) {
      window.location.replace("/?signin=1");
      return;
    }
    refreshBalanceState();
  }, [refreshBalanceState]);

  const handleFetch = useCallback(async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), username: username.trim() || null }),
      });
      const data: FetchResult = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not reach the scanner.");
      if (data.stickers_found === 0) {
        setResult(data);
        if (data.message) setNotice(data.message);
        else setError("No sticker comments found in this video. Try a video where people post stickers.");
      } else {
        setResult(data);
      }
    } catch {
      setError("The scanner is taking too long to answer. Give it a moment and try again.");
    } finally {
      setLoading(false);
    }
  }, [url, username, loading]);

  // Smart delivery: charge credit via POST /download, then deliver the
  // paid bytes the most practical way — OS share sheet (mobile) > clipboard
  // (desktop) > plain download (fallback). Returns a toast key or null.
  const handleDownload = useCallback(
    async (sticker: Sticker, format: string): Promise<string | null> => {
      if (downloading) return null;
      const t = getToken();
      if (!t) {
        window.location.replace("/?signin=1");
        return null;
      }
      setDownloading(sticker.id);
      setSaved(null);
      try {
        const res = await fetch(
          `${API_BASE}/download/${sticker.id}?format=${format}&sticker_url=${encodeURIComponent(sticker.url)}`,
          { method: "POST", headers: { Authorization: `Bearer ${t}` } }
        );
        if (res.status === 402) {
          setShowTopUp(true);
          return null;
        }
        if (res.status === 401) {
          clearSession();
          window.location.replace("/?signin=1");
          return null;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "download failed");
        }
        const blob = await res.blob();

        // ---- delivery (bytes are already paid for) ----
        if (format === "webp") {
          const file = new File([blob], `${sticker.id}.webp`, { type: "image/webp" });
          // 1) mobile: OS share sheet — pick any chat app
          if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: sticker.name || "Sticker" });
              setSaved(sticker.id);
              refreshBalanceState();
              return "shared";
            } catch (err) {
              if (err instanceof DOMException && err.name === "AbortError") {
                // user closed the sheet without sharing — bytes paid, deliver as download
                triggerDownload(blob, `${sticker.id}.webp`);
                setSaved(sticker.id);
                refreshBalanceState();
                return "saved";
              }
              // share failed — fall through to clipboard/download
            }
          }
          // 2) desktop: copy to clipboard for instant paste
          try {
            if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
              await navigator.clipboard.write([new ClipboardItem({ "image/webp": blob })]);
              setSaved(sticker.id);
              refreshBalanceState();
              return "copied";
            }
          } catch {}
          // 3) fallback: plain download
          triggerDownload(blob, `${sticker.id}.webp`);
          setSaved(sticker.id);
          refreshBalanceState();
          return "saved";
        }

        // .wastickers (WA tray import) — always a download
        triggerDownload(blob, `${sticker.id}.${format}`);
        setSaved(sticker.id);
        refreshBalanceState();
        return "waSaved";
      } catch (err) {
        setError(
          err instanceof Error && err.message !== "download failed"
            ? err.message
            : "Download failed. The sticker link may have expired — re-scan and try again."
        );
        return null;
      } finally {
        setDownloading(null);
      }
    },
    [downloading, refreshBalanceState]
  );

  const triggerDownload = (blob: Blob, filename: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  // Toast after Get/WA (auto-dismiss)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((key: string) => {
    setToast(key);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  // Get button: smart-delivery webp; WA button: wastickers tray import
  const handleGet = useCallback(
    async (sticker: Sticker) => {
      const result = await handleDownload(sticker, "webp");
      if (result) showToast(result);
    },
    [handleDownload, showToast]
  );

  const handleWA = useCallback(
    async (sticker: Sticker) => {
      const result = await handleDownload(sticker, "wastickers");
      if (result) showToast(result);
    },
    [handleDownload, showToast]
  );

  // Library rows use sticker_id; map to the Sticker shape + toast on delivery
  const handleLibDownload = useCallback(
    async (s: { sticker_id: string; url: string }, format: string) => {
      const result = await handleDownload({ id: s.sticker_id, url: s.url } as Sticker, format);
      if (result) showToast(result);
    },
    [handleDownload, showToast]
  );

  const filterLabel = username.trim() ? ` from @${username.trim().replace(/^@/, "")}` : "";

  return (
    <div className="min-h-[100dvh]">
      <Navbar variant="app" />
      <div className="mx-auto max-w-[1400px] px-4 md:px-10">
        <section
          className="relative z-[1] mt-8 rounded-[24px] border border-white/5 bg-raised p-5 md:p-8"
        >
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
            <div>
              <label htmlFor="video-url" className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/40">
                TikTok video link
              </label>
              <div className="relative">
                <LinkIcon size={18} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  id="video-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://vt.tiktok.com/… or the full video URL"
                  className="w-full rounded-2xl border border-white/10 bg-background py-3.5 pl-11 pr-4 text-base text-white placeholder:text-white/30 focus-visible:border-accent"
                />
              </div>
            </div>
            <div>
              <label htmlFor="username-filter" className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/40">
                Filter by username
              </label>
              <div className="relative">
                <MagnifyingGlass size={18} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  id="username-filter"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                  placeholder="@sticker_poster"
                  className="w-full rounded-2xl border border-white/10 bg-background py-3.5 pl-11 pr-4 text-base text-white placeholder:text-white/30 focus-visible:border-accent"
                />
              </div>
            </div>
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-accent px-7 py-3.5 text-base font-bold text-accent-fg transition-all hover:shadow-[0_0_40px_rgba(0,255,136,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Scanning…" : "Find stickers"}
              {!loading && <ArrowRight size={18} weight="bold" />}
            </button>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/40">
            Scanning is free. Long-press a sticker comment, note the username, share the video link — paste both here.
          </p>
        </section>

        <section className="relative z-[1] py-14 md:py-16" aria-live="polite">
          {loading && (
            <>
              <p className="mb-6 text-sm font-medium text-white/50">
                Reading the comment section… usually a few seconds.
              </p>
              <StickerSkeleton />
            </>
          )}

          {!loading && error && (
            <div className="flex max-w-[52ch] items-start gap-3 rounded-2xl bg-error-soft p-4 md:p-5">
              <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-error" />
              <div>
                <p className="text-sm font-bold text-white">Scan failed</p>
                <p className="mt-1 text-sm leading-relaxed text-white/50">{error}</p>
                <button onClick={handleFetch} className="mt-3 text-sm font-bold text-accent underline-offset-4 hover:underline">
                  Try the scan again
                </button>
              </div>
            </div>
          )}

          {!loading && notice && result && result.stickers_found === 0 && (
            <div className="flex max-w-[52ch] items-start gap-3 rounded-2xl bg-warn-soft p-4 md:p-5">
              <StickerIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-white/70" />
              <div>
                <p className="text-sm font-bold text-white">Nothing from that user</p>
                <p className="mt-1 text-sm leading-relaxed text-white/50">{notice}</p>
              </div>
            </div>
          )}

          {!loading && !error && result && result.stickers_found === 0 && !notice && (
            <div className="flex max-w-[52ch] flex-col items-start gap-3 rounded-2xl border border-dashed border-white/10 bg-raised p-6 md:p-8">
              <StickerIcon size={28} weight="fill" className="text-white/40" />
              <p className="font-display text-xl font-extrabold tracking-tight">No stickers in these comments</p>
              <p className="text-sm leading-relaxed text-white/50">
                Nobody has posted a sticker in this video yet — or the stickers are buried in replies (which TikTok keeps locked). Try a busier video.
              </p>
            </div>
          )}

          {!loading && !error && result && result.stickers_found > 0 && (
            <div>
              <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-2xl font-black tracking-tight md:text-3xl">
                  {result.stickers_found} sticker{result.stickers_found !== 1 ? "s" : ""}{filterLabel}
                </h2>
                <p className="text-sm text-white/40">found across {result.total_comments} comments</p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
                {result.stickers.map((sticker, i) => (
                  <article
                    key={sticker.id}
                    className={`stagger-item sticker-card die-cut group p-3 hover:-translate-y-1 hover:rotate-0 ${
                      i % 3 === 1 ? "rotate-[1.25deg]" : i % 3 === 2 ? "rotate-[-1.25deg]" : "rotate-0"
                    }`}
                    style={{ ["--index" as string]: i }}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-[1.4rem] bg-background">
                      <img
                        src={sticker.url}
                        alt="Sticker"
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                      {sticker.is_animated && (
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70 backdrop-blur">
                          Animated
                        </span>
                      )}
                    </div>
                    <div className="px-1.5 pb-1 pt-3">
                      <div className="mt-3.5 flex gap-1.5">
                        <button
                          onClick={() => handleGet(sticker)}
                          disabled={downloading === sticker.id}
                          className="flex min-h-[40px] flex-[2] items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2 text-xs font-bold text-accent-fg transition-all hover:shadow-[0_0_30px_rgba(254,44,85,0.45)] active:scale-95 disabled:opacity-50"
                        >
                          {saved === sticker.id ? (
                            <><Check size={14} weight="bold" /> {lib.get}</>
                          ) : downloading === sticker.id ? (
                            "…"
                          ) : (
                            <><ShareFat size={14} weight="bold" /> {lib.get}</>
                          )}
                        </button>
                        <button
                          onClick={() => handleWA(sticker)}
                          disabled={downloading === sticker.id}
                          title="WhatsApp tray import (.wastickers)"
                          className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full bg-accent-2 px-3 py-2 text-xs font-bold text-accent-2-fg transition-transform active:scale-95 disabled:opacity-50"
                        >
                          {downloading === sticker.id ? "…" : <><WhatsappLogo size={14} weight="bold" /> {lib.waBtn}</>}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && !result && (
            <div className="flex flex-col items-center gap-4 pt-4 text-center">
              <p className="max-w-[38ch] text-sm leading-relaxed text-white/40">
                Paste a link above to start. Scanning is free — downloads use your credits.
              </p>
            </div>
          )}
        </section>

        {/* ===== LIBRARY BROWSE (search + sort + pagination) ===== */}
        <LibraryBrowse onDownload={handleLibDownload} />
      </div>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-6 md:px-10">
          <p className="font-body text-xs text-white/35">StickerSync — stickers belong to their original creators on TikTok.</p>
          <p className="font-body text-xs text-white/35">Not affiliated with TikTok or WhatsApp.</p>
        </div>
      </footer>

      {/* Smart-delivery toast (auto-dismiss 5s) */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border border-accent-line bg-accent-soft px-4 py-3 text-center text-sm font-medium text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]"
          role="status"
        >
          {toast === "shared"
            ? lib.toastShared
            : toast === "copied"
            ? lib.toastCopied
            : toast === "waSaved"
            ? lib.toastWASaved
            : lib.toastSaved}
        </div>
      )}

      {/* Top-up modal (payment stub) */}
      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowTopUp(false)}>
          <div
            className="w-full max-w-sm rounded-[24px] border border-white/10 bg-raised p-7 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <Coins size={28} weight="fill" className="text-accent" />
              <button onClick={() => setShowTopUp(false)} aria-label="Close" className="text-muted hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <h3 className="mt-3 font-display text-xl font-bold tracking-tight">Out of credits</h3>
            <p className="mt-2 font-body text-sm leading-relaxed text-muted">
              Top-ups are coming very soon — Rp 500 for 2 credits, and every purchase drops
              a bonus credit into the world pool for everyone.
            </p>
            <div className="mt-5 rounded-2xl bg-accent-soft p-4">
              <p className="font-body text-sm font-semibold text-foreground">Meanwhile…</p>
              <p className="mt-1 font-body text-sm leading-relaxed text-muted">
                The world pool refills whenever someone buys. Check back soon and grab one before others do.
              </p>
            </div>
          </div>
        </div>
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          onModeChange={(m) => setAuthMode(m)}
          onClose={() => setAuthMode(null)}
          onSuccess={() => setAuthMode(null)}
        />
      )}
    </div>
  );
}
