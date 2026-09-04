"use client";

import { memo, useEffect, useRef } from "react";

/**
 * Sticker Hunt Field — ambient background canvas.
 * Static dual-tone grid (pink verticals / cyan horizontals, very low alpha),
 * drifting die-cut sticker silhouettes with parallax, rising TikTok-style
 * heart particles, a slow descending scan beam, and a pink mouse glow.
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
      seedStickers();
    };
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const COLS = 14;
    const ROWS = 9;

    // --- drifting sticker silhouettes ---
    interface StickerBlob {
      x: number;
      y: number;
      size: number;
      rot: number;
      rotSpeed: number;
      speed: number; // upward drift px/s
      wobble: number;
      phase: number;
      tint: string;
    }
    let stickers: StickerBlob[] = [];

    const seedStickers = () => {
      stickers = [];
      const n = 12;
      for (let i = 0; i < n; i++) {
        const size = 40 + Math.random() * 55;
        stickers.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size,
          rot: (Math.random() - 0.5) * 0.35,
          rotSpeed: (Math.random() - 0.5) * 0.0002,
          speed: 8 + (size / 95) * 18, // parallax: bigger = faster
          wobble: 14 + Math.random() * 22,
          phase: Math.random() * Math.PI * 2,
          tint: Math.random() < 0.5 ? "254,44,85" : "105,201,208",
        });
      }
    };
    seedStickers();

    // --- heart particles ---
    interface Heart {
      x: number;
      y: number;
      vy: number;
      life: number; // 0..1 remaining
      size: number;
    }
    const hearts: Heart[] = [];
    let heartTimer = 0;

    const spawnHeart = () => {
      if (stickers.length === 0) return;
      const s = stickers[Math.floor(Math.random() * stickers.length)];
      hearts.push({
        x: s.x + (Math.random() - 0.5) * s.size,
        y: s.y,
        vy: 22 + Math.random() * 18,
        life: 1,
        size: 5 + Math.random() * 4,
      });
    };

    const drawHeart = (cx: number, cy: number, r: number, alpha: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.08) {
        const x = 16 * Math.pow(Math.sin(a), 3);
        const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        ctx.lineTo((x / 16) * r, (y / 16) * r);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(254,44,85,${alpha})`;
      ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cw = W / COLS;
      const ch = H / ROWS;

      // static dual-tone grid — pink verticals, cyan horizontals
      for (let i = 0; i <= COLS; i++) {
        const x = i * cw;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.strokeStyle = "rgba(254,44,85,0.022)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      for (let j = 0; j <= ROWS; j++) {
        const y = j * ch;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.strokeStyle = "rgba(105,201,208,0.022)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // drifting sticker silhouettes (die-cut rounded squares, tilted)
      const dt = 0.016;
      for (const s of stickers) {
        s.y -= s.speed * dt;
        s.rot += s.rotSpeed;
        s.phase += dt;
        if (s.y < -s.size * 1.5) {
          s.y = H + s.size;
          s.x = Math.random() * W;
        }
        const wobbleX = s.x + Math.sin(s.phase * 0.5) * s.wobble * 0.08;
        const alpha = 0.045 + (s.size / 95) * 0.035;

        ctx.save();
        ctx.translate(wobbleX, s.y);
        ctx.rotate(s.rot);
        const r = s.size * 0.22;
        ctx.beginPath();
        ctx.roundRect(-s.size / 2, -s.size / 2, s.size, s.size, r);
        ctx.strokeStyle = `rgba(${s.tint},${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // little "peel" corner accent
        ctx.beginPath();
        ctx.arc(s.size / 2 - 4, -s.size / 2 + 4, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.tint},${alpha * 0.9})`;
        ctx.fill();
        ctx.restore();
      }

      // hearts — spawn every ~3-6s, rise & fade
      heartTimer -= dt;
      if (heartTimer <= 0) {
        spawnHeart();
        heartTimer = 3 + Math.random() * 3;
      }
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i];
        h.y -= h.vy * dt;
        h.life -= dt * 0.28;
        if (h.life <= 0) {
          hearts.splice(i, 1);
          continue;
        }
        drawHeart(h.x, h.y, h.size, Math.min(h.life, 0.5));
      }

      // scan beam — pink gradient line descending every ~8s
      const beamPeriod = 8;
      const beamPhase = (t % beamPeriod) / beamPeriod; // 0..1
      if (beamPhase < 0.35) {
        const beamY = (beamPhase / 0.35) * (H + 120) - 60;
        const grad = ctx.createLinearGradient(0, beamY - 50, 0, beamY + 50);
        grad.addColorStop(0, "rgba(254,44,85,0)");
        grad.addColorStop(0.5, "rgba(254,44,85,0.045)");
        grad.addColorStop(1, "rgba(254,44,85,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, beamY - 50, W, 100);
      }

      // mouse glow — pink
      const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 320);
      glow.addColorStop(0, "rgba(254,44,85,0.05)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      t += dt;
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
