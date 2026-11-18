/**
 * Pure 2D <canvas> particle engine for the First Light landing intro.
 * Uses typed Float32Arrays + offscreen glow sprite stamps + single rAF loop
 * for steady 60fps performance even under 4x CPU throttling.
 */
import { IGNITION_ORDER, getIntroSilhouette } from "./silhouetteData";

export interface SilhouetteLayout {
  width: number;
  height: number;
  dpr: number;
  cx: number;
  cy: number;
  size: number;
  isShortLandscape: boolean;
  isPortrait: boolean;
  repelRadius: number;
}

export interface ParticleEngineState {
  phase: "idle" | "loading" | "ready" | "exiting" | "done" | "skipped";
  ignitedCount: number;
  reducedMotion: boolean;
  sweepProgress: number; // 0..1 during exit pulse sweep
  liftoffProgress: number; // 0..1 outward star drift & fade
}

export function selectParticleBudget(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 2400;
  if (viewportWidth >= 640) return 1400;
  return 1000;
}

export function selectCappedDpr(viewportWidth: number): number {
  if (typeof window === "undefined") return 1;
  const raw = window.devicePixelRatio || 1;
  const nav = window.navigator as Navigator & { deviceMemory?: number };
  const isLowEnd =
    viewportWidth < 768 ||
    (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) ||
    (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4);
  return Math.min(raw, isLowEnd ? 1.5 : 2);
}

export function computeSilhouetteLayout(width: number, height: number): SilhouetteLayout {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const isShortLandscape = safeH < 480;
  const isPortrait = safeW < 640 && safeH >= safeW;

  let size: number;
  let cx: number;
  let cy: number;

  if (isShortLandscape) {
    size = Math.min(safeW * 0.42, safeH * 0.62, 340);
    cx = safeW * 0.34;
    cy = safeH * 0.48;
  } else if (isPortrait) {
    size = Math.min(safeW * 0.72, safeH * 0.56, 440);
    cx = safeW * 0.5;
    cy = safeH * 0.41;
  } else {
    size = Math.min(safeW * 0.72, safeH * 0.62, 760);
    cx = safeW * 0.5;
    cy = safeH * 0.45;
  }

  const minDim = Math.min(safeW, safeH);
  const repelRadius = Math.max(68, Math.min(132, (110 * minDim) / 900));

  return {
    width: safeW,
    height: safeH,
    dpr: selectCappedDpr(safeW),
    cx,
    cy,
    size,
    isShortLandscape,
    isPortrait,
    repelRadius,
  };
}

function createDotSprite(color: string, glowColor: string, glowAlpha: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 20;
  c.height = 20;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(10, 10, 0.5, 10, 10, 9.5);
  grad.addColorStop(0, color);
  grad.addColorStop(0.28, color);
  grad.addColorStop(0.55, glowColor.replace("ALPHA", glowAlpha.toFixed(2)));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 20, 20);
  return c;
}

export class LoaderParticleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private layout: SilhouetteLayout;
  private state: ParticleEngineState;

  private count: number;
  private px: Float32Array;
  private py: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private sx: Float32Array; // initial scatter offset
  private sy: Float32Array;
  private nx: Float32Array; // normalized target [-0.5..0.5]
  private ny: Float32Array;
  private tx: Float32Array; // layout-mapped target px
  private ty: Float32Array;
  private reg: Uint8Array;
  private seeds: Float32Array;

  private pointerX = -9999;
  private pointerY = -9999;
  private pointerActive = false;

  private rafId: number | null = null;
  private startedAt = 0;
  private lastTick = 0;
  private destroyed = false;

  private dimSprite: HTMLCanvasElement | null = null;
  private cyanSprite: HTMLCanvasElement | null = null;
  private violetSprite: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement, initialWidth: number, initialHeight: number, reducedMotion: boolean) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.layout = computeSilhouetteLayout(initialWidth, initialHeight);
    this.state = {
      phase: "idle",
      ignitedCount: 0,
      reducedMotion,
      sweepProgress: 0,
      liftoffProgress: 0,
    };

    const full = getIntroSilhouette();
    const targetBudget = Math.min(selectParticleBudget(this.layout.width), full.count);
    this.count = targetBudget;

    this.px = new Float32Array(targetBudget);
    this.py = new Float32Array(targetBudget);
    this.vx = new Float32Array(targetBudget);
    this.vy = new Float32Array(targetBudget);
    this.sx = new Float32Array(targetBudget);
    this.sy = new Float32Array(targetBudget);
    this.nx = new Float32Array(targetBudget);
    this.ny = new Float32Array(targetBudget);
    this.tx = new Float32Array(targetBudget);
    this.ty = new Float32Array(targetBudget);
    this.reg = new Uint8Array(targetBudget);
    this.seeds = new Float32Array(targetBudget);

    // Deterministic strided sampling so every region keeps balanced density at 1,000 / 1,400 / 2,400 budgets.
    const stride = full.count / targetBudget;
    for (let i = 0; i < targetBudget; i++) {
      const src = Math.min(full.count - 1, Math.floor(i * stride));
      this.nx[i] = full.xs[src];
      this.ny[i] = full.ys[src];
      this.reg[i] = full.regions[src];

      // Deterministic scatter vector per dot
      const h1 = Math.sin(i * 12.9898 + 4.14) * 43758.5453;
      const r1 = h1 - Math.floor(h1);
      const h2 = Math.sin(i * 78.233 + 1.73) * 24634.6345;
      const r2 = h2 - Math.floor(h2);
      this.seeds[i] = r1;

      const angle = r1 * Math.PI * 2;
      const dist = 0.25 + r2 * 0.95;
      this.sx[i] = Math.cos(angle) * dist;
      this.sy[i] = Math.sin(angle) * dist;
    }

    this.dimSprite = createDotSprite("rgba(138, 147, 173, 0.42)", "rgba(34, 211, 238, ALPHA)", 0.08);
    this.cyanSprite = createDotSprite("rgba(34, 211, 238, 0.95)", "rgba(34, 211, 238, ALPHA)", 0.34);
    this.violetSprite = createDotSprite("rgba(167, 139, 250, 0.96)", "rgba(139, 92, 246, ALPHA)", 0.38);

    this.applyLayout(this.layout, true);
    this.attachPointerListeners();
  }

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = e.clientX - rect.left;
    this.pointerY = e.clientY - rect.top;
    this.pointerActive = true;
  };

  private onPointerLeave = () => {
    this.pointerActive = false;
  };

  private attachPointerListeners() {
    if (typeof window === "undefined") return;
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerMove, { passive: true });
    window.addEventListener("pointerup", this.onPointerLeave, { passive: true });
    window.addEventListener("pointercancel", this.onPointerLeave, { passive: true });
    window.document.addEventListener("mouseleave", this.onPointerLeave, { passive: true });
  }

  private detachPointerListeners() {
    if (typeof window === "undefined") return;
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerLeave);
    window.removeEventListener("pointercancel", this.onPointerLeave);
    window.document.removeEventListener("mouseleave", this.onPointerLeave);
  }

  private applyLayout(next: SilhouetteLayout, snapParticles: boolean) {
    this.layout = next;
    const { width, height, dpr, cx, cy, size } = next;

    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (this.canvas.width !== targetW) this.canvas.width = targetW;
    if (this.canvas.height !== targetH) this.canvas.height = targetH;

    for (let i = 0; i < this.count; i++) {
      const tx = cx + this.nx[i] * size;
      const ty = cy + this.ny[i] * size;
      this.tx[i] = tx;
      this.ty[i] = ty;

      if (snapParticles) {
        if (this.state.reducedMotion) {
          this.px[i] = tx;
          this.py[i] = ty;
        } else {
          const scatterSpan = Math.max(width, height) * 0.45;
          this.px[i] = cx + this.sx[i] * scatterSpan;
          this.py[i] = cy + this.sy[i] * scatterSpan;
        }
      }
    }
  }

  resize(width: number, height: number) {
    if (this.destroyed) return;
    const next = computeSilhouetteLayout(width, height);
    // Keep simulation continuous without resetting; snap immediately under reduced motion.
    this.applyLayout(next, this.state.reducedMotion);
    if (this.state.reducedMotion) {
      this.renderFrame(performance.now());
    }
  }

  updateState(next: Partial<ParticleEngineState>) {
    const prevReduced = this.state.reducedMotion;
    this.state = { ...this.state, ...next };
    if (this.state.reducedMotion && !prevReduced) {
      this.stopLoop();
      this.applyLayout(this.layout, true);
      this.renderFrame(performance.now());
    } else if (this.state.reducedMotion) {
      this.renderFrame(performance.now());
    } else if (this.rafId === null && !this.destroyed) {
      this.start();
    }
  }

  start() {
    if (this.destroyed) return;
    const now = performance.now();
    if (!this.startedAt) this.startedAt = now;
    this.lastTick = now;

    if (this.state.reducedMotion) {
      this.applyLayout(this.layout, true);
      this.renderFrame(now);
      return;
    }

    if (this.rafId !== null) return;
    const loop = (ts: number) => {
      if (this.destroyed || this.state.reducedMotion) {
        this.rafId = null;
        return;
      }
      this.stepSimulation(ts);
      this.renderFrame(ts);
      this.rafId = window.requestAnimationFrame(loop);
    };
    this.rafId = window.requestAnimationFrame(loop);
  }

  private stepSimulation(now: number) {
    const dt = Math.min(0.05, Math.max(0.004, (now - this.lastTick) / 1000));
    this.lastTick = now;

    const elapsed = (now - this.startedAt) / 1000;
    const settle = this.state.phase === "idle" ? 0.15 : Math.min(1, elapsed / 0.85);
    const springK = 14 + settle * 42;
    const damping = Math.exp(-8.5 * dt);

    const { cx, cy, width, height, repelRadius } = this.layout;
    const scatterSpan = Math.max(width, height) * 0.38;
    const repelSq = repelRadius * repelRadius;
    const lift = this.state.liftoffProgress;

    for (let i = 0; i < this.count; i++) {
      // Blend target from drifting cosmic dust toward dotted brain silhouette.
      const driftAngle = this.seeds[i] * Math.PI * 2 + elapsed * (0.22 + this.seeds[i] * 0.14);
      const dustX = cx + this.sx[i] * scatterSpan + Math.cos(driftAngle) * 18;
      const dustY = cy + this.sy[i] * scatterSpan + Math.sin(driftAngle) * 18;

      let goalX = dustX + (this.tx[i] - dustX) * settle;
      let goalY = dustY + (this.ty[i] - dustY) * settle;

      if (lift > 0) {
        const dx = this.tx[i] - cx;
        const dy = this.ty[i] - cy;
        const len = Math.hypot(dx, dy) || 1;
        const boost = lift * lift * (160 + this.seeds[i] * 260);
        goalX += (dx / len) * boost + Math.cos(driftAngle) * 28 * lift;
        goalY += (dy / len) * boost - 35 * lift;
      }

      const ax = (goalX - this.px[i]) * springK;
      const ay = (goalY - this.py[i]) * springK;
      this.vx[i] = (this.vx[i] + ax * dt) * damping;
      this.vy[i] = (this.vy[i] + ay * dt) * damping;

      if (this.pointerActive && lift < 0.25) {
        const rx = this.px[i] - this.pointerX;
        const ry = this.py[i] - this.pointerY;
        const d2 = rx * rx + ry * ry;
        if (d2 > 0.5 && d2 < repelSq) {
          const d = Math.sqrt(d2);
          const push = (1 - d / repelRadius) * 850 * dt;
          this.vx[i] += (rx / d) * push;
          this.vy[i] += (ry / d) * push;
        }
      }

      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
    }
  }

  private renderFrame(now: number) {
    const ctx = this.ctx;
    if (!ctx) return;

    const { width, height, dpr, cx, size } = this.layout;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const fadeOut = 1 - Math.min(1, Math.max(0, (this.state.liftoffProgress - 0.15) / 0.85));
    if (fadeOut <= 0.01) return;

    const elapsed = (now - this.startedAt) / 1000;
    const sweep = this.state.sweepProgress;
    const sweepWorldX = cx - size * 0.55 + sweep * (size * 1.1);
    const sweepWidth = size * 0.18;

    const ignitedCap = this.state.ignitedCount;
    const activeReg = Math.max(0, ignitedCap - 1);

    for (let i = 0; i < this.count; i++) {
      const r = this.reg[i];
      const isLit = r < ignitedCap;
      const isNewest = isLit && r === activeReg && this.state.phase === "loading" && !this.state.reducedMotion;
      const isEmphasisRegion = r === 5 || r === 6; // hippocampus / amygdala

      let sprite = this.dimSprite;
      let alpha = 0.52 * fadeOut;
      let drawSize = 5.5;

      if (isLit) {
        sprite = isEmphasisRegion || isNewest ? this.violetSprite : this.cyanSprite;
        const twinkle = this.state.reducedMotion
          ? 0.92
          : 0.78 + 0.22 * Math.sin(elapsed * 2.4 + this.seeds[i] * 12);
        alpha = twinkle * fadeOut;
        drawSize = isNewest || isEmphasisRegion ? 9.5 : 7.8;
      }

      if (sweep > 0 && sweep < 1) {
        const dist = Math.abs(this.px[i] - sweepWorldX);
        if (dist < sweepWidth) {
          const wave = 1 - dist / sweepWidth;
          alpha = Math.min(1, alpha + wave * 0.5) * fadeOut;
          drawSize += wave * 4.2;
          sprite = this.cyanSprite;
        }
      }

      if (!sprite) continue;
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
      const half = drawSize * 0.5;
      ctx.drawImage(sprite, this.px[i] - half, this.py[i] - half, drawSize, drawSize);
    }

    ctx.globalAlpha = 1;
  }

  private stopLoop() {
    if (this.rafId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.detachPointerListeners();
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.dimSprite = null;
    this.cyanSprite = null;
    this.violetSprite = null;
  }
}

export function getIgnitionRegionCount(): number {
  return IGNITION_ORDER.length;
}
