"use client";

import { memo, useCallback, useState } from "react";
import {
  ArrowRight,
  MagnifyingGlass,
  Link as LinkIcon,
  WarningCircle,
  Sticker as StickerIcon,
  DownloadSimple,
  Check,
  WhatsappLogo,
} from "@phosphor-icons/react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860";

interface Sticker {
  id: string;
  name: string;
  width: number;
  height: number;
  is_animated: boolean;
  url: string;
  author: string;
  author_uid: string;
  comment_text: string;
  comment_likes: number;
}

interface FetchResult {
  video_id: string;
  total_comments: number;
  stickers_found: number;
  stickers: Sticker[];
  message?: string;
  detail?: string;
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

function StickerSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-[2rem] border border-line bg-raised p-3"
          aria-hidden
        >
          <div className="skeleton aspect-square rounded-[1.4rem]" />
          <div className="skeleton mt-3 h-3.5 w-3/4 rounded-full" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
          <div className="skeleton mt-4 h-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

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
        if (data.message) {
          setNotice(data.message);
        } else {
          setError("No sticker comments found in this video. Try a video where people post stickers.");
        }
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith("Could not")
          ? err.message
          : "The scanner is taking too long to answer. Give it a moment and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [url, username, loading]);

  const handleDownload = useCallback(
    async (stickerId: string, format: string, name: string) => {
      if (downloading) return;
      setDownloading(stickerId);
      setSaved(null);
      try {
        const res = await fetch(`${API_BASE}/download/${stickerId}?format=${format}`);
        if (!res.ok) throw new Error("download failed");
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}.${format}`;
        a.click();
        URL.revokeObjectURL(a.href);
        setSaved(stickerId);
        window.setTimeout(() => setSaved((s) => (s === stickerId ? null : s)), 2400);
      } catch {
        setError("Download failed. The sticker link may have expired — re-scan the video and try again.");
      } finally {
        setDownloading(null);
      }
    },
    [downloading]
  );

  const filterLabel = username.trim() ? ` from @${username.trim().replace(/^@/, "")}` : "";

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto max-w-[1400px] px-4 md:px-10">
        <header className="flex items-center justify-between py-6">
          <p className="font-display text-lg font-bold tracking-tight">
            Sticker<span className="text-accent">Sync</span>
          </p>
          <a
            href="#how-to"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 font-body text-sm font-medium text-muted transition-colors hover:text-foreground sm:flex"
          >
            <WhatsappLogo size={16} weight="fill" className="text-accent" />
            Made for WhatsApp
          </a>
        </header>

        <section className="grid items-center gap-10 pb-14 pt-6 md:grid-cols-[3fr_2fr] md:gap-16 md:pb-24 md:pt-14">
          <div className="stagger-item" style={{ ["--index" as string]: 0 }}>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              TikTok comments → WhatsApp stickers
            </p>
            <h1 className="mt-4 max-w-[16ch] font-display text-4xl font-bold leading-[1.02] tracking-tighter text-foreground md:text-6xl">
              Steal stickers straight from the comments.
            </h1>
            <p className="mt-5 max-w-[52ch] font-body text-base leading-relaxed text-muted md:text-lg">
              People drop animated stickers in TikTok comment sections. Paste the video
              link, and StickerSync finds every one of them — ready to import into
              WhatsApp in a single tap.
            </p>
          </div>
          <div className="hidden md:block stagger-item" style={{ ["--index" as string]: 2 }}>
            <FloatSticker />
          </div>
        </section>

        <section
          className="rounded-[2.5rem] border border-line bg-raised p-5 md:p-8"
          style={{ boxShadow: "var(--shadow-lift)" }}
        >
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
            <div>
              <label
                htmlFor="video-url"
                className="mb-2 block font-body text-xs font-semibold uppercase tracking-wide text-muted"
              >
                TikTok video link
              </label>
              <div className="relative">
                <LinkIcon
                  size={18}
                  weight="bold"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  id="video-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://vt.tiktok.com/… or the full video URL"
                  className="w-full rounded-2xl border border-line bg-background py-3.5 pl-11 pr-4 font-body text-base text-foreground placeholder:text-muted/70 focus-visible:border-accent"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="username-filter"
                className="mb-2 block font-body text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Filter by username
              </label>
              <div className="relative">
                <MagnifyingGlass
                  size={18}
                  weight="bold"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  id="username-filter"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                  placeholder="@sticker_poster"
                  className="w-full rounded-2xl border border-line bg-background py-3.5 pl-11 pr-4 font-body text-base text-foreground placeholder:text-muted/70 focus-visible:border-accent"
                />
              </div>
            </div>
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-accent px-7 py-3.5 font-body text-base font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Scanning…" : "Find stickers"}
              {!loading && <ArrowRight size={18} weight="bold" />}
            </button>
          </div>
          <p className="mt-4 font-body text-sm leading-relaxed text-muted">
            Tip: long-press a comment with a sticker, note the username, then
            share the video link and paste both here.
          </p>
        </section>

        <section className="py-14 md:py-20" aria-live="polite">
          {loading && (
            <>
              <p className="mb-6 font-body text-sm font-medium text-muted">
                Reading the comment section… this usually takes 5–15 seconds.
              </p>
              <StickerSkeleton />
            </>
          )}

          {!loading && error && (
            <div className="flex max-w-[52ch] items-start gap-3 rounded-2xl bg-error-soft p-4 md:p-5">
              <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-error" />
              <div>
                <p className="font-body text-sm font-semibold text-foreground">Scan failed</p>
                <p className="mt-1 font-body text-sm leading-relaxed text-muted">{error}</p>
                <button
                  onClick={handleFetch}
                  className="mt-3 font-body text-sm font-semibold text-accent underline-offset-4 hover:underline"
                >
                  Try the scan again
                </button>
              </div>
            </div>
          )}

          {!loading && notice && result && result.stickers_found === 0 && (
            <div className="flex max-w-[52ch] items-start gap-3 rounded-2xl bg-warn-soft p-4 md:p-5">
              <StickerIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-foreground/70" />
              <div>
                <p className="font-body text-sm font-semibold text-foreground">
                  Nothing from that user
                </p>
                <p className="mt-1 font-body text-sm leading-relaxed text-muted">{notice}</p>
              </div>
            </div>
          )}

          {!loading && !error && result && result.stickers_found === 0 && !notice && (
            <div className="flex max-w-[52ch] flex-col items-start gap-3 rounded-2xl border border-dashed border-line bg-raised p-6 md:p-8">
              <StickerIcon size={28} weight="fill" className="text-muted" />
              <p className="font-display text-xl font-bold tracking-tight">
                No stickers in these comments
              </p>
              <p className="font-body text-sm leading-relaxed text-muted">
                Nobody has posted a sticker in this video yet — or the stickers are
                buried in replies (which TikTok keeps locked). Try a busier video.
              </p>
            </div>
          )}

          {!loading && !error && result && result.stickers_found > 0 && (
            <div>
              <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  {result.stickers_found} sticker{result.stickers_found !== 1 ? "s" : ""}
                  {filterLabel}
                </h2>
                <p className="font-body text-sm text-muted">
                  found across {result.total_comments} comments
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
                {result.stickers.map((sticker, i) => (
                  <article
                    key={sticker.id}
                    className={`stagger-item sticker-card group rounded-[2rem] border border-line bg-raised p-3 hover:-translate-y-1 hover:rotate-0 ${
                      i % 3 === 1 ? "rotate-[1.25deg]" : i % 3 === 2 ? "rotate-[-1.25deg]" : "rotate-0"
                    }`}
                    style={{
                      ["--index" as string]: i,
                      boxShadow: "var(--shadow-lift)",
                    }}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-[1.4rem] bg-background">
                      <img
                        src={sticker.url}
                        alt={`Sticker posted by @${sticker.author_uid}`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                      {sticker.is_animated && (
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-foreground/80 backdrop-blur">
                          Animated
                        </span>
                      )}
                    </div>
                    <div className="px-1.5 pb-1 pt-3">
                      {sticker.comment_text && (
                        <p className="truncate font-body text-xs text-muted">
                          &ldquo;{sticker.comment_text}&rdquo;
                        </p>
                      )}
                      <p className="mt-0.5 truncate font-body text-sm font-semibold text-foreground">
                        @{sticker.author_uid || sticker.author}
                      </p>
                      <div className="mt-3.5 flex gap-1.5">
                        <button
                          onClick={() => handleDownload(sticker.id, "wastickers", sticker.name)}
                          disabled={downloading === sticker.id}
                          className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2 font-body text-xs font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98] disabled:opacity-50"
                        >
                          {saved === sticker.id ? (
                            <>
                              <Check size={14} weight="bold" /> Saved
                            </>
                          ) : downloading === sticker.id ? (
                            "Packaging…"
                          ) : (
                            <>
                              <DownloadSimple size={14} weight="bold" /> .wastickers
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDownload(sticker.id, "webp", sticker.name)}
                          disabled={downloading === sticker.id}
                          className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-background px-3 py-2 font-body text-xs font-semibold text-foreground transition-colors hover:border-muted active:translate-y-px active:scale-[0.98] disabled:opacity-50"
                        >
                          .webp
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
              <p className="max-w-[38ch] font-body text-sm leading-relaxed text-muted">
                Paste a link above to start. Stickers found in the comments will
                show up right here.
              </p>
            </div>
          )}
        </section>

        <section id="how-to" className="border-t border-line py-14 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            From comment to chat in three steps
          </h2>
          <div className="mt-8 max-w-[65ch] divide-y divide-border">
            <div className="flex gap-4 pb-6 md:gap-6">
              <span className="font-display text-lg font-bold text-accent">01</span>
              <p className="font-body text-sm leading-relaxed text-muted md:text-base">
                <strong className="text-foreground">Spot a sticker you like.</strong>{" "}
                Open a TikTok video and long-press the sticker comment to see who
                posted it — note that username.
              </p>
            </div>
            <div className="flex gap-4 py-6 md:gap-6">
              <span className="font-display text-lg font-bold text-accent">02</span>
              <p className="font-body text-sm leading-relaxed text-muted md:text-base">
                <strong className="text-foreground">Paste the link here.</strong>{" "}
                Share the video, copy the link, drop it in the search box above —
                add the username if you want only theirs.
              </p>
            </div>
            <div className="flex gap-4 pt-6 md:gap-6">
              <span className="font-display text-lg font-bold text-accent">03</span>
              <p className="font-body text-sm leading-relaxed text-muted md:text-base">
                <strong className="text-foreground">Import to WhatsApp.</strong>{" "}
                Download the <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs">.wastickers</code>{" "}
                file, open it on your phone, and it lands in your sticker tray. On
                WhatsApp Web, just drag the <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs">.webp</code> into a chat.
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-6 md:px-10">
          <p className="font-body text-xs text-muted">
            StickerSync — stickers belong to their original creators on TikTok.
          </p>
          <p className="font-body text-xs text-muted">
            Not affiliated with TikTok or WhatsApp.
          </p>
        </div>
      </footer>
    </div>
  );
}
