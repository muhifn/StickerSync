"use client";

import { memo, useEffect, useRef, useState } from "react";

export const Cursor = memo(function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.style.cursor = "none";

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rX = x;
    let rY = y;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      }
      const target = e.target as HTMLElement | null;
      const interactive = target?.closest("a, button, input, summary, [role='menuitem']");
      if (ringRef.current) {
        ringRef.current.dataset.active = interactive ? "true" : "false";
      }
    };

    const loop = () => {
      rX += (x - rX) * 0.16;
      rY += (y - rY) * 0.16;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${rX}px, ${rY}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      document.documentElement.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden />
      <div ref={ringRef} className="cursor-ring" aria-hidden />
    </>
  );
});
