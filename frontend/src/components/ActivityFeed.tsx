"use client";

import { memo, useEffect, useState } from "react";
import { DownloadSimple, Sparkle } from "@phosphor-icons/react";
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
      className="overflow-hidden rounded-[2rem] border border-line bg-raised"
      style={{ boxShadow: "var(--shadow-lift)" }}
      aria-label="Live activity"
    >
      <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
          {t.title}
        </p>
      </div>
      <div className="divide-y divide-border">
        {events === null && (
          <div className="space-y-3 p-5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-4 w-4/5 rounded-full" />
            ))}
          </div>
        )}
        {events !== null && events.length === 0 && (
          <div className="flex items-center gap-3 p-6">
            <Sparkle size={22} weight="fill" className="shrink-0 text-accent" />
            <p className="font-body text-sm leading-relaxed text-muted">{t.empty}</p>
          </div>
        )}
        {events !== null &&
          events.map((e, i) => (
            <p
              key={`${e.author_uid}-${i}`}
              className="stagger-item flex items-baseline gap-2 px-5 py-3 font-mono text-xs leading-relaxed"
              style={{ ["--index" as string]: i }}
            >
              <DownloadSimple size={13} weight="bold" className="mt-0.5 shrink-0 self-start text-accent" />
              <span className="min-w-0 flex-1">
                <span className="text-foreground">
                  {e.comment_text ? `“${e.comment_text}”` : "a sticker"}
                </span>{" "}
                <span className="text-muted">
                  {t.by} @{e.author_uid || "unknown"}
                </span>{" "}
                <span className="text-muted/70">— {t.grabbed} {e.ago}</span>
              </span>
            </p>
          ))}
      </div>
    </div>
  );
});
