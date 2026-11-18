import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { REGION_IDS } from "@/features/brain/regionZones";
import { generateProceduralBrainPointsAsync } from "@/features/brain/proceduralBrainCore";
import {
  buildIntroSilhouettePoints,
  encodeSilhouetteDataset,
} from "../../../../scripts/generate-intro-silhouette";
import {
  INTRO_TIMING,
  createIntroState,
  transitionIntro,
} from "./introMachine";
import { computeSilhouetteLayout, selectParticleBudget } from "./loaderParticles";
import {
  IGNITION_ORDER,
  INTRO_DISCLAIMER,
  INTRO_SILHOUETTE_PAYLOAD,
  REGION_CAPTIONS,
  getIntroSilhouette,
} from "./silhouetteData";

describe("introMachine timing and state rules", () => {
  it("skips immediately without flicker when brain and fonts are ready within 400 ms", () => {
    let state = createIntroState({ mountedAtMs: 0 });
    state = transitionIntro(state, { type: "FONTS_READY", nowMs: 120 });
    state = transitionIntro(state, { type: "TICK", nowMs: 250 });
    expect(state.phase).toBe("idle");

    state = transitionIntro(state, { type: "BRAIN_READY", nowMs: 360 });
    expect(state.phase).toBe("done");
    expect(state.overlayMounted).toBe(false);
    expect(state.headlineReleased).toBe(true);
    expect(state.progress).toBe(1);
  });

  it("enforces >= 1200 ms minimum visible duration once animated loader starts, then exits with 60% headline release", () => {
    let state = createIntroState({ mountedAtMs: 0 });
    state = transitionIntro(state, { type: "FONTS_READY", nowMs: 100 });
    state = transitionIntro(state, { type: "TICK", nowMs: 410 });
    expect(state.phase).toBe("loading");
    expect(state.loadingShownAtMs).toBe(410);

    // Brain finishes quickly at 700 ms (only 290 ms after loader shown) -> holds in ready.
    state = transitionIntro(state, { type: "BRAIN_READY", nowMs: 700 });
    expect(state.phase).toBe("ready");
    expect(state.overlayMounted).toBe(true);
    expect(state.headlineReleased).toBe(false);
    expect(state.ignitedCount).toBe(IGNITION_ORDER.length);

    // Still inside 1200 ms hold at 1500 ms (410 + 1090).
    state = transitionIntro(state, { type: "TICK", nowMs: 1500 });
    expect(state.phase).toBe("ready");

    // Crosses 410 + 1200 = 1610 ms -> enters exiting.
    state = transitionIntro(state, { type: "TICK", nowMs: 1620 });
    expect(state.phase).toBe("exiting");
    expect(state.headlineReleased).toBe(false);

    // At 50% of 900 ms exit (~450 ms elapsed), headline stays held.
    state = transitionIntro(state, { type: "TICK", nowMs: 1620 + 450 });
    expect(state.phase).toBe("exiting");
    expect(state.headlineReleased).toBe(false);

    // At 62% of 900 ms exit (~558 ms elapsed), headline reveals.
    state = transitionIntro(state, { type: "TICK", nowMs: 1620 + 560 });
    expect(state.phase).toBe("exiting");
    expect(state.headlineReleased).toBe(true);

    // At end of 900 ms exit -> done & persist flag.
    state = transitionIntro(state, {
      type: "TICK",
      nowMs: 1620 + INTRO_TIMING.exitDurationMs,
    });
    expect(state.phase).toBe("done");
    expect(state.overlayMounted).toBe(false);
    expect(state.shouldPersistSeen).toBe(true);
  });

  it("enforces hard timeout at 12 s and hands off gracefully", () => {
    let state = createIntroState({ mountedAtMs: 100 });
    state = transitionIntro(state, { type: "TICK", nowMs: 550 });
    expect(state.phase).toBe("loading");

    state = transitionIntro(state, {
      type: "TICK",
      nowMs: 100 + INTRO_TIMING.hardTimeoutMs,
    });
    expect(state.phase).toBe("exiting");
    expect(state.timedOut).toBe(true);
    expect(state.shouldPersistSeen).toBe(true);

    state = transitionIntro(state, {
      type: "TICK",
      nowMs: 100 + INTRO_TIMING.hardTimeoutMs + INTRO_TIMING.exitDurationMs,
    });
    expect(state.phase).toBe("done");
    expect(state.overlayMounted).toBe(false);
    expect(state.headlineReleased).toBe(true);
  });

  it("skips immediately when WebGL is unsupported", () => {
    const init = createIntroState({ webglSupported: false });
    expect(init.phase).toBe("skipped");
    expect(init.overlayMounted).toBe(false);
    expect(init.headlineReleased).toBe(true);

    let active = createIntroState({ mountedAtMs: 0, webglSupported: true });
    active = transitionIntro(active, { type: "WEBGL_UNSUPPORTED", nowMs: 50 });
    expect(active.phase).toBe("skipped");
    expect(active.overlayMounted).toBe(false);
    expect(active.headlineReleased).toBe(true);
  });

  it("shows Skip button after 2500 ms and runs a 250 ms fade on skip", () => {
    let state = createIntroState({ mountedAtMs: 0 });
    state = transitionIntro(state, { type: "TICK", nowMs: 420 });
    expect(state.canSkip).toBe(false);

    state = transitionIntro(state, { type: "TICK", nowMs: 2499 });
    expect(state.canSkip).toBe(false);

    state = transitionIntro(state, { type: "TICK", nowMs: 2510 });
    expect(state.canSkip).toBe(true);

    state = transitionIntro(state, { type: "SKIP", nowMs: 2600 });
    expect(state.phase).toBe("skipped");
    expect(state.shouldPersistSeen).toBe(true);
    expect(state.headlineReleased).toBe(true);
    expect(state.overlayMounted).toBe(true);

    state = transitionIntro(state, { type: "TICK", nowMs: 2750 });
    expect(state.overlayMounted).toBe(true);

    state = transitionIntro(state, { type: "TICK", nowMs: 2860 });
    expect(state.overlayMounted).toBe(false);
  });

  it("keeps repeat visits within session in minimal hairline mode and exits smoothly", () => {
    let state = createIntroState({ mountedAtMs: 0, seenInSession: true });
    expect(state.variant).toBe("minimal");

    state = transitionIntro(state, { type: "TICK", nowMs: 600 });
    expect(state.phase).toBe("idle"); // never enters full silhouette animation

    state = transitionIntro(state, { type: "FONTS_READY", nowMs: 650 });
    state = transitionIntro(state, { type: "BRAIN_READY", nowMs: 700 });
    expect(state.phase).toBe("exiting");
    expect(state.headlineReleased).toBe(true);

    state = transitionIntro(state, {
      type: "TICK",
      nowMs: 700 + INTRO_TIMING.exitReducedMs,
    });
    expect(state.phase).toBe("done");
    expect(state.overlayMounted).toBe(false);
  });

  it("supports reducedMotion with all regions lit quietly, working skip, and 200 ms fade exit", () => {
    let state = createIntroState({ mountedAtMs: 0, reducedMotion: true });
    state = transitionIntro(state, { type: "FONTS_READY", nowMs: 100 });
    state = transitionIntro(state, { type: "TICK", nowMs: 450 });
    expect(state.phase).toBe("loading");
    expect(state.ignitedCount).toBe(IGNITION_ORDER.length);

    state = transitionIntro(state, { type: "BRAIN_READY", nowMs: 1700 });
    expect(state.phase).toBe("exiting");

    state = transitionIntro(state, {
      type: "TICK",
      nowMs: 1700 + INTRO_TIMING.exitReducedMs,
    });
    expect(state.phase).toBe("done");
    expect(state.overlayMounted).toBe(false);
  });

  it("keeps progress monotonically increasing across real stages", () => {
    let state = createIntroState({ mountedAtMs: 0 });
    const samples: number[] = [];

    const events = [
      { stage: "chunk" as const, value: 0.4 },
      { stage: "chunk" as const, value: 1.0 },
      { stage: "geometry" as const, value: 0.5, pointsPlaced: 20000, pointsTotal: 40000 },
      { stage: "chunk" as const, value: 0.2 }, // out-of-order regression attempt
      { stage: "geometry" as const, value: 1.0, pointsPlaced: 40000, pointsTotal: 40000 },
      { stage: "shaders" as const, value: 0.5 },
      { stage: "shaders" as const, value: 1.0 },
      { stage: "firstFrame" as const, value: 1.0 },
    ];

    for (const ev of events) {
      state = transitionIntro(state, { type: "PROGRESS", ...ev, nowMs: 500 });
      samples.push(state.progress);
    }

    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(state.progress).toBe(1);
    expect(state.pointsPlaced).toBe(40000);
    expect(state.pointsTotal).toBe(40000);
    expect(state.stageLabel).toBe("FIRST LIGHT");
  });
});

describe("intro silhouette generator, decoder, and responsive sizing", () => {
  it("matches committed payload deterministically and stays compact (< 4 KB gz)", () => {
    const regenerated = encodeSilhouetteDataset(buildIntroSilhouettePoints());
    expect(regenerated).toBe(INTRO_SILHOUETTE_PAYLOAD);

    const gzBytes = gzipSync(Buffer.from(INTRO_SILHOUETTE_PAYLOAD, "utf8")).byteLength;
    expect(gzBytes).toBeLessThan(4096);
  });

  it("decodes ~2,450 points with valid region indices across all 7 regions and honest captions", () => {
    const decoded = getIntroSilhouette();
    expect(decoded.count).toBeGreaterThanOrEqual(2400);
    expect(decoded.count).toBeLessThanOrEqual(2550);

    for (let i = 0; i < decoded.count; i++) {
      const regIdx = decoded.regions[i];
      expect(regIdx).toBeGreaterThanOrEqual(0);
      expect(regIdx).toBeLessThan(IGNITION_ORDER.length);
      expect(REGION_IDS).toContain(IGNITION_ORDER[regIdx]);
      expect(decoded.xs[i]).toBeGreaterThanOrEqual(-0.5);
      expect(decoded.xs[i]).toBeLessThanOrEqual(0.5);
      expect(decoded.ys[i]).toBeGreaterThanOrEqual(-0.5);
      expect(decoded.ys[i]).toBeLessThanOrEqual(0.5);
    }

    for (const r of IGNITION_ORDER) {
      expect(decoded.regionCounts[IGNITION_ORDER.indexOf(r)]).toBeGreaterThan(100);
      const caption = REGION_CAPTIONS[r];
      expect(caption).toContain("commonly associated with");
      expect(caption).not.toMatch(/brain score|improves|grows|measures|diagnos/i);
    }
    expect(INTRO_DISCLAIMER).toBe("Educational associations, not measurements.");
  });

  it("caps silhouette size <= 760px on ultrawide, centers slightly high on portrait phones, and scales particle budget", () => {
    expect(selectParticleBudget(390)).toBe(1000);
    expect(selectParticleBudget(768)).toBe(1400);
    expect(selectParticleBudget(1440)).toBe(2400);

    const ultrawide = computeSilhouetteLayout(2560, 1440);
    expect(ultrawide.size).toBeLessThanOrEqual(760);

    const portrait = computeSilhouetteLayout(390, 844);
    expect(portrait.isPortrait).toBe(true);
    expect(portrait.cy).toBeLessThan(844 * 0.5);

    const landscapePhone = computeSilhouetteLayout(844, 390);
    expect(landscapePhone.isShortLandscape).toBe(true);
    expect(landscapePhone.size).toBeLessThanOrEqual(340);
  });

  it("time-slices async procedural geometry cleanly and reports real placement progress", async () => {
    const reports: Array<[number, number]> = [];
    const data = await generateProceduralBrainPointsAsync(18000, 1337, {
      chunkSize: 6000,
      yieldBetweenChunks: true,
      onProgress: (placed, total) => reports.push([placed, total]),
    });
    expect(data.count).toBe(18000);
    expect(reports.length).toBeGreaterThanOrEqual(3);
    expect(reports[reports.length - 1]).toEqual([18000, 18000]);
  });
});
