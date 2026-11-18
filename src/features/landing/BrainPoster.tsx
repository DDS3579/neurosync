interface PosterDot {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  cyan: boolean;
}

function buildPosterDots(): PosterDot[] {
  const dots: PosterDot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cortexCount = 190;

  for (let i = 0; i < cortexCount; i++) {
    const t = (i + 0.5) / cortexCount;
    const rad = Math.sqrt(t);
    const angle = i * golden;
    // Lateral cortex contour with subtle frontal/occipital asymmetry
    const x = 160 + Math.cos(angle) * rad * 102;
    const y = 114 + Math.sin(angle) * rad * 72 - Math.cos(angle) * 7;
    dots.push({
      cx: Number(x.toFixed(1)),
      cy: Number(y.toFixed(1)),
      r: Number((1.05 + (1 - rad) * 1.45).toFixed(2)),
      opacity: Number((0.2 + (1 - rad) * 0.58).toFixed(2)),
      cyan: i % 3 !== 0,
    });
  }

  // Cerebellum cluster (posterior-inferior)
  for (let i = 0; i < 36; i++) {
    const t = (i + 0.5) / 36;
    const rad = Math.sqrt(t);
    const angle = i * golden;
    dots.push({
      cx: Number((98 + Math.cos(angle) * rad * 34).toFixed(1)),
      cy: Number((184 + Math.sin(angle) * rad * 22).toFixed(1)),
      r: Number((0.95 + (1 - rad) * 1.1).toFixed(2)),
      opacity: Number((0.22 + (1 - rad) * 0.48).toFixed(2)),
      cyan: i % 2 === 0,
    });
  }

  return dots;
}

const POSTER_DOTS = buildPosterDots();

/**
 * Static CSS radial dotted brain silhouette shown before BrainHero mounts
 * and when `prefers-reduced-motion` is enabled.
 */
export function BrainPoster({ className }: { className?: string }) {
  const hasPosition = /\b(absolute|fixed|sticky|static|relative)\b/.test(className ?? "");
  return (
    <div
      aria-hidden="true"
      className={`${hasPosition ? "" : "relative "}flex h-full w-full items-center justify-center overflow-hidden bg-[#060913]${
        className ? ` ${className}` : ""
      }`}
    >
      {/* Subtle radial dot matrix masked into a soft circular field */}
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(230,234,245,0.28) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage:
            "radial-gradient(circle at 50% 48%, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.45) 28%, transparent 58%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 48%, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.45) 28%, transparent 58%)",
        }}
      />

      {/* Quiet radial observatory glow behind the silhouette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 48%, rgba(34,211,238,0.10), rgba(139,92,246,0.06) 34%, transparent 62%)",
        }}
      />

      {/* Dotted brain silhouette */}
      <svg
        viewBox="0 0 320 240"
        className="relative h-64 w-80 opacity-85 sm:h-80 sm:w-[420px]"
      >
        {POSTER_DOTS.map((d, idx) => (
          <circle
            key={idx}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill={d.cyan ? "#22D3EE" : "#8B5CF6"}
            fillOpacity={d.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
