"use client";

import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";

interface Star {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  r: number;
  alpha: number;
  speed: number;
  tint: string;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createStarfield(): Star[] {
  const rand = mulberry32(0x4e455552);
  const stars: Star[] = [];
  const layers = [
    { count: 70, rMin: 0.55, rMax: 0.9, aMin: 0.14, aMax: 0.28, speed: 0.03 },
    { count: 50, rMin: 0.85, rMax: 1.25, aMin: 0.24, aMax: 0.44, speed: 0.07 },
    { count: 30, rMin: 1.15, rMax: 1.65, aMin: 0.36, aMax: 0.62, speed: 0.13 },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const tintRoll = rand();
      const tint =
        tintRoll > 0.88 ? "34, 211, 238" : tintRoll > 0.78 ? "139, 92, 246" : "230, 234, 245";
      stars.push({
        x: rand(),
        y: rand(),
        r: layer.rMin + rand() * (layer.rMax - layer.rMin),
        alpha: layer.aMin + rand() * (layer.aMax - layer.aMin),
        speed: layer.speed,
        tint,
      });
    }
  }

  return stars;
}

const STARS = createStarfield();

// Self-contained inline SVG fractal-noise tile (no external network requests).
const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

/**
 * Fixed global atmosphere layers:
 * 1. Very faint hairline grid
 * 2. 3-layer parallax starfield (~150 stars) drawn onto a lightweight canvas
 * 3. Film grain at 4% opacity
 */
export function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId: number | null = null;
    let lastDrawnScroll = -1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      lastDrawnScroll = -1;
      draw();
    };

    const draw = () => {
      rafId = null;
      const scrollY = reducedMotion ? 0 : window.scrollY;
      if (scrollY === lastDrawnScroll && lastDrawnScroll !== -1) return;
      lastDrawnScroll = scrollY;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < STARS.length; i++) {
        const star = STARS[i];
        const x = star.x * width;
        const rawY = star.y * height - scrollY * star.speed;
        const y = ((rawY % height) + height) % height;

        ctx.fillStyle = `rgba(${star.tint}, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const onScroll = () => {
      if (reducedMotion || rafId !== null) return;
      rafId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    if (!reducedMotion) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[2] overflow-hidden select-none"
    >
      {/* 1. Very faint hairline grid */}
      <div
        className="absolute inset-0 opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* 2. 3-layer parallax starfield (~150 stars) */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 3. Film grain at 4% opacity */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: GRAIN_DATA_URI,
          backgroundRepeat: "repeat",
          backgroundSize: "160px 160px",
        }}
      />
    </div>
  );
}
