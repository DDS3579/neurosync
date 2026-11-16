import { ImageResponse } from "next/og";

export const alt = "NeuroSync — An observatory for your inner universe";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function buildOgBrainDots() {
  const dots: Array<{ cx: number; cy: number; r: number; o: number; cyan: boolean }> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const total = 110;
  for (let i = 0; i < total; i++) {
    const t = (i + 0.5) / total;
    const rad = Math.sqrt(t);
    const angle = i * golden;
    dots.push({
      cx: Number((180 + Math.cos(angle) * rad * 116).toFixed(1)),
      cy: Number((130 + Math.sin(angle) * rad * 82 - Math.cos(angle) * 6).toFixed(1)),
      r: Number((1.8 + (1 - rad) * 2.0).toFixed(2)),
      o: Number((0.28 + (1 - rad) * 0.62).toFixed(2)),
      cyan: i % 3 !== 0,
    });
  }
  for (let i = 0; i < 22; i++) {
    const t = (i + 0.5) / 22;
    const rad = Math.sqrt(t);
    const angle = i * golden;
    dots.push({
      cx: Number((108 + Math.cos(angle) * rad * 38).toFixed(1)),
      cy: Number((212 + Math.sin(angle) * rad * 24).toFixed(1)),
      r: Number((1.6 + (1 - rad) * 1.4).toFixed(2)),
      o: Number((0.3 + (1 - rad) * 0.5).toFixed(2)),
      cyan: i % 2 === 0,
    });
  }
  return dots;
}

const OG_DOTS = buildOgBrainDots();

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#060913",
          color: "#E6EAF5",
          padding: "72px 84px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            maxWidth: "660px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: 18,
              letterSpacing: "0.22em",
              color: "#22D3EE",
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#22D3EE",
              }}
            />
            NEUROSYNC · OBSERVATORY
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 64,
              lineHeight: 1.02,
              fontWeight: 600,
              letterSpacing: "-0.04em",
            }}
          >
            <span>Understand your brain.</span>
            <span>Understand yourself.</span>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#8A93AD",
            }}
          >
            Local-first brain atlas, fast daily logs, and honest personal experiments.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 360,
            height: 270,
          }}
        >
          <svg width="360" height="270" viewBox="0 0 360 270">
            {OG_DOTS.map((d, i) => (
              <circle
                key={i}
                cx={d.cx}
                cy={d.cy}
                r={d.r}
                fill={d.cyan ? "#22D3EE" : "#8B5CF6"}
                fillOpacity={d.o}
              />
            ))}
          </svg>
        </div>
      </div>
    ),
    { ...size },
  );
}
