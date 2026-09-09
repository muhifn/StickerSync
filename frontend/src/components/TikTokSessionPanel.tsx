"use client";

import { useCallback, useEffect, useState } from "react";
import { Cookie, LockKey, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { API_BASE, getToken } from "@/lib/auth";
import { dict } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";

interface SessionStatus {
  linked: boolean;
  username?: string;
  updated_at?: string;
}

export function TikTokSessionPanel() {
  const { locale } = useLocale();
  const t = dict[locale].session;
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [cookie, setCookie] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/tiktok-session`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) setStatus(await res.json());
      } catch {
        /* offline: panel stays collapsed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const link = useCallback(async () => {
    const token = getToken();
    if (!token || !cookie.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/tiktok-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookie.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || t.invalid);
        return;
      }
      setStatus({ linked: true, username: data.username });
      setCookie("");
      setOpen(false);
    } catch {
      setError(t.invalid);
    } finally {
      setBusy(false);
    }
  }, [cookie, busy, t.invalid]);

  const unlink = useCallback(async () => {
    const token = getToken();
    if (!token || busy) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/tiktok-session`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus({ linked: false });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (status === null) return null;

  return (
    <div className="rounded-[20px] border border-white/5 bg-raised p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <Cookie size={18} weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary">{t.title}</p>
          <p className="mt-0.5 text-xs text-secondary">
            {status.linked ? t.linked.replace("{user}", status.username || "TikTok") : t.desc}
          </p>
        </div>
        {status.linked ? (
          <button
            onClick={unlink}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-secondary transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-50"
          >
            <Trash size={13} /> {t.unlink}
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-bg transition hover:brightness-110"
          >
            <LockKey size={13} /> {t.link}
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-raised p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-primary">{t.title}</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-secondary transition hover:bg-white/5 hover:text-primary"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3.5 text-xs leading-relaxed text-secondary">
              <span className="mb-1.5 flex items-center gap-1.5 font-medium text-amber-300">
                <WarningCircle size={14} /> {t.warningTitle}
              </span>
              {t.warning}
            </div>

            <ol className="mt-4 space-y-1.5 text-xs text-secondary">
              {t.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>

            <textarea
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder={t.placeholder}
              rows={3}
              spellCheck={false}
              className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-bg px-3.5 py-2.5 text-xs text-primary outline-none transition placeholder:text-tertiary focus:border-accent/50"
            />

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <div className="mt-4 flex gap-2.5">
              <button
                onClick={link}
                disabled={busy || !cookie.trim()}
                className="flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-40"
              >
                {busy ? t.checking : t.link}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-secondary transition hover:bg-white/5"
              >
                {t.cancel}
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-tertiary">
              {t.privacy}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
