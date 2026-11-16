"use client";

/**
 * Static CSS/SVG radial dotted brain silhouette fallback rendered when WebGL is
 * unsupported or the graphics context is lost.
 */
import { cn } from "@/lib/utils";

/* Deterministic spiral dot field shaped to a lateral brain + cerebellum profile. */
function buildSilhouetteDots(): Array<{ cx: number; cy: number; r: number; o: number; cyan: boolean }> {
  const dots: Array<{ cx: number; cy: number; r: number; o: number; cyan: boolean }> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const total = 150;
  for (let i = 0; i < total; i++) {
    const t = (i + 0.5) / total;
    const rad = Math.sqrt(t);
    const angle = i * golden;
    // Lateral cortex oval
    const x = 120 + Math.cos(angle) * rad * 76;
    const y = 84 + Math.sin(angle) * rad * 54 - Math.cos(angle) * 6;
    dots.push({
      cx: Number(x.toFixed(1)),
      cy: Number(y.toFixed(1)),
      r: Number((1.1 + (1 - rad) * 1.4).toFixed(2)),
      o: Number((0.28 + (1 - rad) * 0.62).toFixed(2)),
      cyan: i % 3 !== 0,
    });
  }
  // Cerebellum cluster (posterior-inferior)
  for (let i = 0; i < 28; i++) {
    const t = (i + 0.5) / 28;
    const rad = Math.sqrt(t);
    const angle = i * golden;
    dots.push({
      cx: Number((74 + Math.cos(angle) * rad * 26).toFixed(1)),
      cy: Number((138 + Math.sin(angle) * rad * 17).toFixed(1)),
      r: Number((1.0 + (1 - rad) * 1.1).toFixed(2)),
      o: Number((0.3 + (1 - rad) * 0.5).toFixed(2)),
      cyan: i % 2 === 0,
    });
  }
  return dots;
}

const SILHOUETTE_DOTS = buildSilhouetteDots();

export function BrainFallback({
  lost,
  onRetry,
  className,
}: {
  lost: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden bg-[#060913] p-6 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(34,211,238,0.14), rgba(139,92,246,0.08) 42%, transparent 72%)",
        }}
      />
      <svg
        viewBox="0 0 240 180"
        className="relative h-40 w-56 opacity-90"
        role="img"
        aria-label="Stylised dotted brain silhouette"
      >
        {SILHOUETTE_DOTS.map((d, idx) => (
          <circle
            key={idx}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill={d.cyan ? "#22D3EE" : "#8B5CF6"}
            fillOpacity={d.o}
          />
        ))}
      </svg>
      <p className="relative max-w-xs text-xs text-[#8A93AD]">
        {lost
          ? "The 3D graphics context was interrupted by your browser."
          : "Interactive 3D view requires WebGL, which is unavailable in this environment."}
      </p>
      {lost && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="relative rounded-md border border-white/10 bg-[#0C1222] px-3 py-1.5 text-xs font-medium text-[#E6EAF5] transition-colors hover:border-[#22D3EE]/50"
        >
          Restore 3D view
        </button>
      ) : null}
    </div>
  );
}
