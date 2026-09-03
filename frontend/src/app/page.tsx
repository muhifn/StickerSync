"use client";

import { memo, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  MagnifyingGlass,
  Link as LinkIcon,
  WarningCircle,
  Sticker as StickerIcon,
  DownloadSimple,
  Check,
  Gift,
  Coins,
  X,
  EnvelopeSimple,
  LockSimple,
  UserPlus,
  SignIn,
  GoogleLogo,
} from "@phosphor-icons/react";
import {
  API_BASE,
  getToken,
  setSession,
  signup as apiSignup,
  login as apiLogin,
  clearSession,
} from "@/lib/auth";

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

interface MeInfo {
  user_id: string;
  private_credits: number;
  free_downloads: number;
  referral_code: string;
  is_purchaser: boolean;
  pool_claims_today: number;
  pool_daily_limit: number | null;
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
        <div key={i} className="rounded-[2rem] border border-line bg-raised p-3" aria-hidden>
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
  const [needLogin, setNeedLogin] = useState(false);

  // Auth + balance state (native)
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [pool, setPool] = useState<number | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);

  // Login/signup modal state
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setSignedIn(false);
      setMe(null);
      return;
    }
    setSignedIn(true);
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        clearSession();
        setSignedIn(false);
        setMe(null);
        return;
      }
      if (res.ok) setMe(await res.json());
    } catch {}
  }, []);

  // Restore session on mount
  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // World pool: fetch + 30s poll
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/pool`);
        const data = await res.json();
        if (alive) setPool(data.pool);
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  // Referral capture from ?ref=
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) window.localStorage.setItem("stickersync_ref", ref);
  }, []);

  // OAuth redirect handler: #token=xxx&uid=yyy or #auth_error=code
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");
    const uid = params.get("uid");
    const authErr = params.get("auth_error");
    if (token && uid) {
      setSession(token, uid);
      setSignedIn(true);
      // clear hash without reload
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      refreshMe();
      return;
    }
    if (authErr) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setAuthError(
        authErr === "denied"
          ? "Google sign-in was cancelled. Try again or use email."
          : authErr === "email"
          ? "We couldn't verify your Google email. Try again or use email."
          : "The sign-in session expired. Please try again."
      );
      setAuthMode("login");
    }
  }, [refreshMe]);

  const handleAuth = useCallback(
    async (mode: "login" | "signup") => {
      if (authBusy || !email.trim() || !password) return;
      setAuthBusy(true);
      setAuthError(null);
      try {
        const refCode = window.localStorage.getItem("stickersync_ref");
        const result =
          mode === "signup"
            ? await apiSignup(email.trim(), password, refCode || undefined)
            : await apiLogin(email.trim(), password);
        if (!result.ok) {
          setAuthError(result.error);
          return;
        }
        setAuthMode(null);
        setPassword("");
        setSignedIn(true);
        refreshMe();
      } finally {
        setAuthBusy(false);
      }
    },
    [authBusy, email, password, refreshMe]
  );

  const handleSignOut = useCallback(() => {
    clearSession();
    setSignedIn(false);
    setMe(null);
  }, []);

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
    async (sticker: Sticker, format: string) => {
      if (downloading) return;
      const t = getToken();
      if (!t) {
        setNeedLogin(true);
        return;
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
          return;
        }
        if (res.status === 401) {
          clearSession();
          setSignedIn(false);
          setNeedLogin(true);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "download failed");
        }
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${sticker.id}.${format === "webp" ? "webp" : format}`;
        a.click();
        URL.revokeObjectURL(a.href);
        setSaved(sticker.id);
        window.setTimeout(() => setSaved((s) => (s === sticker.id ? null : s)), 2400);
        refreshMe();
      } catch (err) {
        setError(
          err instanceof Error && err.message !== "download failed"
            ? err.message
            : "Download failed. The sticker link may have expired — re-scan and try again."
        );
      } finally {
        setDownloading(null);
      }
    },
    [downloading, refreshMe]
  );

  const filterLabel = username.trim() ? ` from @${username.trim().replace(/^@/, "")}` : "";

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto max-w-[1400px] px-4 md:px-10">
        <header className="flex items-center justify-between py-6">
          <p className="font-display text-lg font-bold tracking-tight">
            Sticker<span className="text-accent">Sync</span>
          </p>
          <div className="flex items-center gap-3">
            {pool !== null && (
              <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 font-body text-xs font-semibold text-foreground">
                <Gift size={14} weight="fill" className="text-accent" />
                World pool: <span className="font-mono">{pool}</span>
              </span>
            )}
            {signedIn && me ? (
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1.5 font-body text-xs font-semibold transition-colors hover:border-muted"
              >
                <Coins size={14} weight="fill" className="text-accent" />
                {me.free_downloads > 0
                  ? `${me.free_downloads} free`
                  : `${me.private_credits} credits`}
              </button>
            ) : (
              <button
                onClick={() => setAuthMode("login")}
                className="flex min-h-[36px] items-center gap-2 rounded-full bg-accent px-4 py-2 font-body text-sm font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98]"
              >
                <SignIn size={16} weight="bold" /> Sign in
              </button>
            )}
          </div>
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
              link, find every sticker, and import them into WhatsApp in a single tap.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Gift size={16} weight="fill" className="text-accent" />
                {pool !== null ? (
                  <><span className="font-mono font-semibold text-foreground">{pool}</span> credits raining in the world pool</>
                ) : "World pool warming up…"}
              </span>
            </div>
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
              <label htmlFor="video-url" className="mb-2 block font-body text-xs font-semibold uppercase tracking-wide text-muted">
                TikTok video link
              </label>
              <div className="relative">
                <LinkIcon size={18} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
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
              <label htmlFor="username-filter" className="mb-2 block font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Filter by username
              </label>
              <div className="relative">
                <MagnifyingGlass size={18} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
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
            Scanning is free. Long-press a sticker comment, note the username, share the video link — paste both here.
          </p>
        </section>

        <section className="py-14 md:py-20" aria-live="polite">
          {loading && (
            <>
              <p className="mb-6 font-body text-sm font-medium text-muted">
                Reading the comment section… usually a few seconds.
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
                <button onClick={handleFetch} className="mt-3 font-body text-sm font-semibold text-accent underline-offset-4 hover:underline">
                  Try the scan again
                </button>
              </div>
            </div>
          )}

          {!loading && notice && result && result.stickers_found === 0 && (
            <div className="flex max-w-[52ch] items-start gap-3 rounded-2xl bg-warn-soft p-4 md:p-5">
              <StickerIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-foreground/70" />
              <div>
                <p className="font-body text-sm font-semibold text-foreground">Nothing from that user</p>
                <p className="mt-1 font-body text-sm leading-relaxed text-muted">{notice}</p>
              </div>
            </div>
          )}

          {!loading && !error && result && result.stickers_found === 0 && !notice && (
            <div className="flex max-w-[52ch] flex-col items-start gap-3 rounded-2xl border border-dashed border-line bg-raised p-6 md:p-8">
              <StickerIcon size={28} weight="fill" className="text-muted" />
              <p className="font-display text-xl font-bold tracking-tight">No stickers in these comments</p>
              <p className="font-body text-sm leading-relaxed text-muted">
                Nobody has posted a sticker in this video yet — or the stickers are buried in replies (which TikTok keeps locked). Try a busier video.
              </p>
            </div>
          )}

          {!loading && !error && result && result.stickers_found > 0 && (
            <div>
              <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  {result.stickers_found} sticker{result.stickers_found !== 1 ? "s" : ""}{filterLabel}
                </h2>
                <p className="font-body text-sm text-muted">found across {result.total_comments} comments</p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
                {result.stickers.map((sticker, i) => (
                  <article
                    key={sticker.id}
                    className={`stagger-item sticker-card group rounded-[2rem] border border-line bg-raised p-3 hover:-translate-y-1 hover:rotate-0 ${
                      i % 3 === 1 ? "rotate-[1.25deg]" : i % 3 === 2 ? "rotate-[-1.25deg]" : "rotate-0"
                    }`}
                    style={{ ["--index" as string]: i, boxShadow: "var(--shadow-lift)" }}
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
                        <p className="truncate font-body text-xs text-muted">&ldquo;{sticker.comment_text}&rdquo;</p>
                      )}
                      <p className="mt-0.5 truncate font-body text-sm font-semibold text-foreground">
                        @{sticker.author_uid || sticker.author}
                      </p>
                      <div className="mt-3.5 flex gap-1.5">
                        <button
                          onClick={() => handleDownload(sticker, "wastickers")}
                          disabled={downloading === sticker.id}
                          className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2 font-body text-xs font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98] disabled:opacity-50"
                        >
                          {saved === sticker.id ? (
                            <><Check size={14} weight="bold" /> Saved</>
                          ) : downloading === sticker.id ? (
                            "…"
                          ) : (
                            <><DownloadSimple size={14} weight="bold" /> Download</>
                          )}
                        </button>
                        <button
                          onClick={() => handleDownload(sticker, "webp")}
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
                Paste a link above to start. New accounts get 3 free downloads — no card needed.
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
                Open a TikTok video and long-press the sticker comment to see who posted it — note that username.
              </p>
            </div>
            <div className="flex gap-4 py-6 md:gap-6">
              <span className="font-display text-lg font-bold text-accent">02</span>
              <p className="font-body text-sm leading-relaxed text-muted md:text-base">
                <strong className="text-foreground">Paste the link here.</strong>{" "}
                Share the video, copy the link, drop it in the search box above — add the username if you want only theirs.
              </p>
            </div>
            <div className="flex gap-4 pt-6 md:gap-6">
              <span className="font-display text-lg font-bold text-accent">03</span>
              <p className="font-body text-sm leading-relaxed text-muted md:text-base">
                <strong className="text-foreground">Import to WhatsApp.</strong>{" "}
                Download the <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs">.wastickers</code> file, open it on your phone, and it lands in your sticker tray.
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-6 md:px-10">
          <p className="font-body text-xs text-muted">StickerSync — stickers belong to their original creators on TikTok.</p>
          <p className="font-body text-xs text-muted">Not affiliated with TikTok or WhatsApp.</p>
        </div>
      </footer>

      {/* Login / signup modal */}
      {(needLogin || authMode) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm"
          onClick={() => {
            setNeedLogin(false);
            setAuthMode(null);
            setAuthError(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-[2rem] border border-line bg-background p-7"
            style={{ boxShadow: "var(--shadow-sticker)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <StickerIcon size={28} weight="fill" className="text-accent" />
              <button
                onClick={() => {
                  setNeedLogin(false);
                  setAuthMode(null);
                  setAuthError(null);
                }}
                aria-label="Close"
                className="text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <h3 className="mt-3 font-display text-xl font-bold tracking-tight">
              {authMode === "signup" ? "Create your account" : "Welcome back"}
            </h3>
            <p className="mt-1.5 font-body text-sm leading-relaxed text-muted">
              {authMode === "signup"
                ? "New accounts get 3 free downloads — no card needed."
                : "Sign in to keep your credits and downloads."}
            </p>

            {authMode && (
              <>
                <a
                  href={`${API_BASE}/auth/oauth/google/start${
                    typeof window !== "undefined" && window.localStorage.getItem("stickersync_ref")
                      ? `?ref=${window.localStorage.getItem("stickersync_ref")}`
                      : ""
                  }`}
                  className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-full border border-line bg-raised px-5 py-3 font-body text-sm font-semibold text-foreground transition-all hover:border-muted active:translate-y-px active:scale-[0.98]"
                >
                  <GoogleLogo size={18} weight="fill" />
                  {authMode === "signup" ? "Continue with Google" : "Sign in with Google"}
                </a>
                <div className="my-4 flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-body text-xs uppercase tracking-wide text-muted">or</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleAuth(authMode === "signup" ? "signup" : "login");
              }}
            >
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  Email
                </label>
                <div className="relative">
                  <EnvelopeSimple
                    size={18}
                    weight="bold"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full rounded-2xl border border-line bg-raised py-3 pl-11 pr-4 font-body text-base text-foreground placeholder:text-muted/70 focus-visible:border-accent"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  Password
                </label>
                <div className="relative">
                  <LockSimple
                    size={18}
                    weight="bold"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-2xl border border-line bg-raised py-3 pl-11 pr-4 font-body text-base text-foreground placeholder:text-muted/70 focus-visible:border-accent"
                  />
                </div>
              </div>

              {authError && (
                <p className="rounded-xl bg-error-soft px-3 py-2 font-body text-xs font-medium text-error">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authBusy || !email.trim() || !password}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-body text-sm font-semibold text-accent-fg transition-transform active:translate-y-px active:scale-[0.98] disabled:opacity-40"
              >
                {authBusy ? (
                  "…"
                ) : authMode === "signup" ? (
                  <>
                    <UserPlus size={18} weight="bold" /> Create account
                  </>
                ) : (
                  <>
                    <SignIn size={18} weight="bold" /> Sign in
                  </>
                )}
              </button>
            </form>

            <button
              onClick={() => {
                setAuthError(null);
                setAuthMode(authMode === "signup" ? "login" : "signup");
              }}
              className="mt-4 w-full font-body text-sm text-muted transition-colors hover:text-foreground"
            >
              {authMode === "signup"
                ? "Already have an account? Sign in"
                : "New here? Create an account — get 3 free downloads"}
            </button>
          </div>
        </div>
      )}

      {/* Top-up modal (payment stub) */}
      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm" onClick={() => setShowTopUp(false)}>
          <div
            className="w-full max-w-sm rounded-[2rem] border border-line bg-background p-7"
            style={{ boxShadow: "var(--shadow-sticker)" }}
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
    </div>
  );
}
