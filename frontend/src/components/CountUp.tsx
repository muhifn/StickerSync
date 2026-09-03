"use client";

import { memo, useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number | null;
  duration?: number; // ms
  locale?: string;
  className?: string;
}

export const CountUp = memo(function CountUp({
  value,
  duration = 1200,
  locale = "en-US",
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);

  // trigger on first viewport entry
  useEffect(() => {
    const el = ref.current;
    if (!el || started) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  // animate when triggered + value known
  useEffect(() => {
    if (!started || value === null) return;
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(eased * value));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started, value, duration]);

  return (
    <span ref={ref} className={className}>
      {value === null ? "…" : display.toLocaleString(locale)}
    </span>
  );
});
