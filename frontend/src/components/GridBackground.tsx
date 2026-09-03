"use client";

import { memo, useEffect, useRef } from "react";

/**
 * GoClip-style animated background: fixed full-screen canvas,
 * green grid (14×9) with sine-wave breathing lines, pulsing
 * intersection dots, and a radial glow that follows the mouse.
 * Disabled entirely under prefers-reduced-motion.
 */
export const GridBackground = memo(function GridBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let mx = W / 2;
    let my = H / 3;
    let t = 0;
    let raf = 0;

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const COLS = 14;
    const ROWS = 9;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cw = W / COLS;
      const ch = H / ROWS;

      // vertical lines
      for (let i = 0; i <= COLS; i++) {
        const x = i * cw;
        const alpha = 0.03 + 0.018 * Math.sin(t * 0.5 + i * 0.4);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      // horizontal lines
      for (let j = 0; j <= ROWS; j++) {
        const y = j * ch;
        const alpha = 0.03 + 0.018 * Math.sin(t * 0.4 + j * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      // pulsing intersection dots
      for (let i = 0; i <= COLS; i++) {
        for (let j = 0; j <= ROWS; j++) {
          const x = i * cw;
          const y = j * ch;
          const pulse = Math.sin(t * 0.8 + i * 0.3 + j * 0.4);
          if (pulse > 0.7) {
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,255,136,${(pulse - 0.7) * 1.5})`;
            ctx.fill();
          }
        }
      }
      // mouse glow
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 320);
      grad.addColorStop(0, "rgba(0,255,136,0.05)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      t += 0.016;
      raf = requestAnimationFrame(draw);
    };

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
    />
  );
});
