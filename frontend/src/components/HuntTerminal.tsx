"use client";

import { memo, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/auth";
import { dict, detectLocale, type Locale } from "@/lib/i18n";

interface ActivityEvent {
  comment_text: string;
  author_uid: string;
  ago: string;
}

type LineKind = "scan" | "download" | "sync" | "progress";

interface TerminalLine {
  kind: LineKind;
  text: string;
  progress?: number;
  ts: string;
}

/**
 * HuntTerminal — live activity feed as an animated terminal.
 * Boot sequence + typewriter lines with verb prefixes (SCAN/DOWNLOAD/SYNC),
 * blinking caret, ASCII progress separators, subtle CRT scanlines.
 * Reduced-motion: everything renders instantly, no typing.
 */
export const HuntTerminal = memo(function HuntTerminal() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [boot, setBoot] = useState<string[]>([]);
  const [typed, setTyped] = useState<TerminalLine[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const reducedRef = useRef(false);
  const timers = useRef<number[]>([]);

  const t = dict[locale].terminal;

  useEffect(() => {
    setLocale(detectLocale());
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Build terminal lines from activity events
  const buildLines = (evts: ActivityEvent[]): TerminalLine[] => {
    const now = () =>
      new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const lines: TerminalLine[] = [];
    evts.slice(0, 8).forEach((e, i) => {
      lines.push({
        kind: "download",
        text: `"${(e.comment_text || "a sticker").slice(0, 34)}" grabbed by @${e.author_uid || "unknown"} — ${e.ago}`,
        ts: now(),
      });
      // every 3rd event: a SCAN line + progress + SYNC line
      if (i % 3 === 2) {
        const vid = Math.floor(1000000000 + Math.random() * 8999999999);
        lines.push({ kind: "scan", text: t.scanLine.replace("%s", String(vid)).replace("%s", String(1 + i)), ts: now() });
        lines.push({ kind: "progress", text: t.progress.replace("%s", "100"), progress: 100, ts: now() });
        lines.push({ kind: "sync", text: t.syncLine, ts: now() });
      }
    });
    return lines;
  };

  // Boot sequence + typewriter feed once in viewport
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting) && !startedRef.current) {
          startedRef.current = true;
          ob.disconnect();
          runTerminal();
        }
      },
      { threshold: 0.25 }
    );
    ob.observe(el);
    return () => ob.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const runTerminal = () => {
    const reduced = reducedRef.current;
    const boots = [t.boot1, t.boot2, t.boot3];

    if (reduced) {
      setBoot(boots);
      setTyped(events ? buildLines(events) : []);
      return;
    }

    // boot lines type in
    boots.forEach((b, i) => {
      timers.current.push(
        window.setTimeout(() => setBoot((prev) => [...prev, b]), 350 + i * 550)
      );
    });

    // then feed types in line by line
    const startAt = 350 + boots.length * 550 + 250;
    const evts = events;
    if (!evts) return;
    const lines = buildLines(evts);
    lines.forEach((line, i) => {
      timers.current.push(
        window.setTimeout(() => setTyped((prev) => [...prev.slice(-11), line]), startAt + i * 420)
      );
    });
  };

  // fetch activity
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
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const verbClass = (kind: LineKind) =>
    kind === "scan" ? "text-accent" : kind === "sync" ? "text-accent-2" : "text-accent-2";
  const verbLabel = (kind: LineKind) =>
    kind === "scan" ? t.verbs.scan : kind === "sync" ? t.verbs.sync : t.verbs.download;

  const bar = (pct: number) => {
    const filled = Math.round((pct / 100) * 10);
    return "█".repeat(filled) + "░".repeat(10 - filled);
  };

  return (
    <div
      ref={rootRef}
      className="crt relative overflow-hidden rounded-[20px] border border-accent-line bg-[#0b0508]"
      aria-label="Live hunt activity"
    >
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#140a10] px-5 py-3.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-[#25d366]" aria-hidden />
        <span className="ml-3 truncate font-mono text-xs text-white/40">{t.prompt}</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-accent">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          {t.live}
        </span>
      </div>

      {/* body */}
      <div className="min-h-[280px] px-6 py-6 font-mono text-[13px] leading-[2] md:px-8">
        {/* boot */}
        {boot.map((b, i) => (
          <p key={`boot-${i}`} className="text-white/50">
            {b}
          </p>
        ))}

        {/* feed lines */}
        {typed.map((line, i) => (
          <p key={`line-${i}-${line.ts}`} className="flex items-baseline gap-3">
            <span className="hidden shrink-0 text-white/25 sm:inline">[{line.ts}]</span>
            <span className={`shrink-0 font-bold ${verbClass(line.kind)}`}>
              ✓ {verbLabel(line.kind)}
            </span>
            {line.kind === "progress" ? (
              <span className="text-white/60">
                <span className="text-accent-2">{bar(line.progress ?? 0)}</span> {line.progress}%
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-white/65">{line.text}</span>
            )}
          </p>
        ))}

        {/* skeleton while loading */}
        {events === null && typed.length === 0 && (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-4 w-4/5 rounded-full" />
            ))}
          </div>
        )}

        {/* empty */}
        {events !== null && events.length === 0 && boot.length === 3 && (
          <p className="text-white/40">{t.empty}</p>
        )}

        {/* caret line */}
        <p className="flex items-center gap-2">
          <span className="text-accent">$</span>
          <span className="caret" aria-hidden />
        </p>
      </div>
    </div>
  );
});
