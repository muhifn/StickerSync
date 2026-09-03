"use client";

import { memo, useEffect, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { API_BASE } from "@/lib/auth";
import { dict, detectLocale, type Locale } from "@/lib/i18n";

interface ActivityEvent {
  comment_text: string;
  author_uid: string;
  ago: string;
}

export const ActivityFeed = memo(function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const t = dict[locale].feed;

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/activity`);
        const data = await res.json();
        if (alive) setEvents(data.events || []);
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div
      className="overflow-hidden rounded-[20px] border border-accent-line bg-[#080810]"
      aria-label="Live activity"
    >
      {/* mac title bar */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#0f0f18] px-5 py-3.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden />
        <span className="ml-3 font-mono text-xs text-white/40">{t.title}</span>
      </div>

      <div className="px-6 py-6 font-mono text-[13px] leading-[2.1] md:px-8">
        {events === null && (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-4 w-4/5 rounded-full" />
            ))}
          </div>
        )}
        {events !== null && events.length === 0 && (
          <p className="text-white/40">{t.empty}</p>
        )}
        {events !== null &&
          events.slice(0, 10).map((e, i) => (
            <p key={`${e.author_uid}-${i}`} className="feed-line flex gap-3" style={{ ["--index" as string]: i }}>
              <span className="text-accent" aria-hidden>●</span>
              <span className="min-w-0 flex-1 text-white/60">
                <span className="text-white">&ldquo;{e.comment_text || "a sticker"}&rdquo;</span>{" "}
                {t.by} <span className="text-accent">@{e.author_uid || "unknown"}</span> — {t.grabbed} {e.ago}
              </span>
            </p>
          ))}
      </div>
    </div>
  );
});
