"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { BookmarkSimple, Check } from "@phosphor-icons/react";
import { API_BASE, getToken } from "@/lib/auth";
import { dict, detectLocale, type Locale } from "@/lib/i18n";

interface CrateButtonProps {
  stickerId: string;
  url: string;
  className?: string;
}

/** Bookmark toggle: add/remove sticker snapshot to my crate (wishlist). */
export const CrateButton = memo(function CrateButton({ stickerId, url, className }: CrateButtonProps) {
  const [inCrate, setInCrate] = useState<boolean | null>(null); // null = unknown/loading
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  const t = dict[locale].crate;

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  // load initial state (bulk endpoint would be nicer; fine for now)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/crate`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) {
          setInCrate((data.stickers || []).some((s: { sticker_id: string }) => s.sticker_id === stickerId));
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [stickerId]);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy || inCrate === null) return;
      setBusy(true);
      try {
        if (inCrate) {
          await fetch(`${API_BASE}/crate/remove`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ sticker_id: stickerId, url }),
          });
          setInCrate(false);
        } else {
          await fetch(`${API_BASE}/crate/add`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ sticker_id: stickerId, url, is_animated: true }),
          });
          setInCrate(true);
        }
      } catch {}
      setBusy(false);
    },
    [busy, inCrate, stickerId, url]
  );

  return (
    <button
      onClick={toggle}
      aria-pressed={inCrate === true}
      aria-label={inCrate ? t.added : t.addBtn}
      title={inCrate ? t.added : t.addBtn}
      className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all active:scale-90 ${
        inCrate
          ? "border-accent bg-accent text-accent-fg"
          : "border-white/15 bg-background/70 text-white/60 backdrop-blur hover:border-white/40 hover:text-white"
      } ${className || ""}`}
    >
      {busy ? (
        <span className="h-3 w-3 animate-pulse rounded-full bg-white/50" />
      ) : inCrate ? (
        <Check size={14} weight="bold" />
      ) : (
        <BookmarkSimple size={14} weight="bold" />
      )}
    </button>
  );
});
