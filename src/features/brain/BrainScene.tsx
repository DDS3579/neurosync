"use client";

/**
 * React Three Fiber scenes for both BrainExplorer and BrainHero.
 * Loaded dynamically (`ssr: false`) by the client wrappers so Three/WebGL never touches SSR.
 */
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

import { BRAIN_REGIONS } from "@/data/brainRegions";
import type { RegionId } from "@/types/domain";
import { generateBrainPoints, sampleBrainFromObject, type BrainPointData } from "./brainGeometry";
import { buildConnectionGeometries } from "./connections";
import {
  INTERNAL_REGIONS,
  REGION_ANCHORS,
  REGION_IDS,
  REGION_PROXIES,
  REGION_SLOTS,
  REGION_VIEWS,
  regionIndex,
  type BrainMode,
} from "./regionZones";
import {
  brainPointsFragment,
  brainPointsVertex,
  connectionLineFragment,
  connectionPulseFragment,
  connectionVertex,
} from "./shaders/brainPoints";
import { FPS_GOVERNOR, type BrainQuality, type QualityPref } from "./useBrainQuality";

/* ------------------------------------------------------------------ */
/* TUNABLES                                                            */
/* ------------------------------------------------------------------ */
const GLB_URL = "/models/brain.glb";

const PALETTE = {
  violet: new THREE.Color("#8B5CF6"),
  cyan: new THREE.Color("#22D3EE"),
  dim: new THREE.Color("#18223C"),
  /** Calm ice/cyan tints for anatomy mode (index 7 = unassigned). */
  anatomy: [
    "#7DD3FC", // prefrontal
    "#67E8F9", // parietal
    "#5EEAD4", // temporal
    "#93C5FD", // occipital
    "#38BDF8", // cerebellum
    "#A5F3FC", // hippocampus (brighter cluster)
    "#C4B5FD", // amygdala (brighter cluster)
    "#3B5170", // unassigned
  ].map((c) => new THREE.Color(c)),
  /** Distinct, tasteful hues for functional network mode (index 7 = unassigned). */
  functional: [
    "#8B5CF6", // prefrontal — violet
    "#22D3EE", // parietal — cyan
    "#34D399", // temporal — emerald
    "#60A5FA", // occipital — sky blue
    "#FBBF24", // cerebellum — warm amber
    "#F472B6", // hippocampus — rose
    "#FB7185", // amygdala — coral
    "#283554", // unassigned
  ].map((c) => new THREE.Color(c)),
} as const;

const CAMERA = {
  fov: 42,
  explorerStart: [1.9, 0.55, 2.35] as [number, number, number],
  minDistance: 1.45,
  maxDistance: 4.8,
  idleResumeSec: 4.0,
  idleSpeed: 0.12, // rad/sec
  dampLambda: 7.5,
  cameraDamp: 4.5,
} as const;

const POINTS_SIZE = { explorer: 14.5, hero: 15.5, pulse: 22 } as const;

const REGION_NAME: Record<RegionId, string> = Object.fromEntries(
  BRAIN_REGIONS.map((r) => [r.id, r.name]),
) as Record<RegionId, string>;

/* ------------------------------------------------------------------ */
/* GLB PROBE + ERROR BOUNDARY                                          */
/* ------------------------------------------------------------------ */
class GlbErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}

function GlbSampler({
  pointCount,
  onSampled,
}: {
  pointCount: number;
  onSampled: (data: BrainPointData) => void;
}) {
  const gltf = useGLTF(GLB_URL);
  useEffect(() => {
    const sampled = sampleBrainFromObject(gltf.scene, pointCount);
    onSampled(sampled);
  }, [gltf.scene, pointCount, onSampled]);
  return null;
}

/**
 * Checks whether `/models/brain.glb` is actually served before mounting `useGLTF`,
 * avoiding unhandled load errors when running procedurally.
 */
function useGlbProbe(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(GLB_URL, { method: "HEAD" })
      .then((res) => {
        if (cancelled || !res.ok) return;
        const type = res.headers.get("content-type") ?? "";
        if (!type.includes("text/html")) setAvailable(true);
      })
      .catch(() => {
        // Missing asset: silently stay procedural.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}

function useBrainPointData(pointCount: number) {
  const procedural = useMemo(() => generateBrainPoints(pointCount), [pointCount]);
  const glbAvailable = useGlbProbe();
  const [glbData, setGlbData] = useState<BrainPointData | null>(null);
  const onSampled = useCallback((d: BrainPointData) => setGlbData(d), []);
  const data = glbData && glbData.count === pointCount ? glbData : procedural;
  return { data, glbAvailable, onSampled };
}

function OptionalGlbLoader({
  enabled,
  pointCount,
  onSampled,
}: {
  enabled: boolean;
  pointCount: number;
  onSampled: (data: BrainPointData) => void;
}) {
  if (!enabled) return null;
  return (
    <GlbErrorBoundary>
      <Suspense fallback={null}>
        <GlbSampler pointCount={pointCount} onSampled={onSampled} />
      </Suspense>
    </GlbErrorBoundary>
  );
}

/* ------------------------------------------------------------------ */
/* SHARED GEOMETRY + SHADER MATERIAL HELPERS                           */
/* ------------------------------------------------------------------ */
function buildPointsGeometry(data: BrainPointData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  geo.setAttribute("aRegion", new THREE.BufferAttribute(data.regions, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(data.seeds, 1));
  geo.setAttribute("aKind", new THREE.BufferAttribute(data.kinds, 1));
  geo.setAttribute("aFold", new THREE.BufferAttribute(data.folds, 1));
  geo.setAttribute("aScatter", new THREE.BufferAttribute(data.scatter, 3));
  geo.computeBoundingSphere();
  return geo;
}

interface BrainUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uTime: THREE.IUniform<number>;
  uPixelRatio: THREE.IUniform<number>;
  uSize: THREE.IUniform<number>;
  uPulseSize: THREE.IUniform<number>;
  uQuality: THREE.IUniform<number>;
  uMotion: THREE.IUniform<number>;
  uModeW: THREE.IUniform<THREE.Vector3>;
  uSelected: THREE.IUniform<number>;
  uHovered: THREE.IUniform<number>;
  uSelectW: THREE.IUniform<number[]>;
  uHoverW: THREE.IUniform<number[]>;
  uActivity: THREE.IUniform<number[]>;
  uAnySelected: THREE.IUniform<number>;
  uInternalVis: THREE.IUniform<number>;
  uCortexAlpha: THREE.IUniform<number>;
  uAnatomyColor: THREE.IUniform<THREE.Color[]>;
  uFuncColor: THREE.IUniform<THREE.Color[]>;
  uCentroid: THREE.IUniform<THREE.Vector3[]>;
  uViolet: THREE.IUniform<THREE.Color>;
  uCyan: THREE.IUniform<THREE.Color>;
  uDim: THREE.IUniform<THREE.Color>;
  uProgress: THREE.IUniform<number>;
  uTint: THREE.IUniform<number>;
  uPointer: THREE.IUniform<THREE.Vector2>;
  uPointerAmt: THREE.IUniform<number>;
}

function createBrainUniforms(dpr: number, tier: "low" | "high", size: number, initialProgress: number): BrainUniforms {
  const centroids = [
    ...REGION_IDS.map((id) => new THREE.Vector3(...REGION_ANCHORS[id])),
    new THREE.Vector3(0, 0, 0),
  ];
  return {
    uTime: { value: 0 },
    uPixelRatio: { value: dpr },
    uSize: { value: size },
    uPulseSize: { value: POINTS_SIZE.pulse },
    uQuality: { value: tier === "high" ? 1 : 0 },
    uMotion: { value: 1 },
    uModeW: { value: new THREE.Vector3(1, 0, 0) },
    uSelected: { value: -1 },
    uHovered: { value: -1 },
    uSelectW: { value: new Array<number>(REGION_SLOTS).fill(0) },
    uHoverW: { value: new Array<number>(REGION_SLOTS).fill(0) },
    uActivity: { value: new Array<number>(REGION_SLOTS).fill(0) },
    uAnySelected: { value: 0 },
    uInternalVis: { value: 0.48 },
    uCortexAlpha: { value: 0.72 },
    uAnatomyColor: { value: PALETTE.anatomy.map((c) => c.clone()) },
    uFuncColor: { value: PALETTE.functional.map((c) => c.clone()) },
    uCentroid: { value: centroids },
    uViolet: { value: PALETTE.violet.clone() },
    uCyan: { value: PALETTE.cyan.clone() },
    uDim: { value: PALETTE.dim.clone() },
    uProgress: { value: initialProgress },
    uTint: { value: 0 },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uPointerAmt: { value: 0 },
  };
}

function dampValue(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

/* ------------------------------------------------------------------ */
/* FPS GOVERNOR                                                        */
/* ------------------------------------------------------------------ */
function FpsGovernor({
  qualityPref,
  tier,
  downgrade,
}: {
  qualityPref: QualityPref;
  tier: "low" | "high";
  downgrade: () => void;
}) {
  const stateRef = useRef({ elapsed: 0, frames: 0, windowSec: 0, tripped: false });

  useFrame((_, delta) => {
    if (qualityPref !== "auto" || tier === "low" || stateRef.current.tripped) return;
    const clamped = Math.min(delta, 0.25);
    const s = stateRef.current;
    s.elapsed += clamped;
    if (s.elapsed < FPS_GOVERNOR.warmupSec) return;
    s.frames += 1;
    s.windowSec += clamped;
    if (s.windowSec >= FPS_GOVERNOR.windowSec) {
      const fps = s.frames / s.windowSec;
      if (fps < FPS_GOVERNOR.minFps) {
        s.tripped = true;
        downgrade();
      }
      s.frames = 0;
      s.windowSec = 0;
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* EXPLORER CONTENT                                                    */
/* ------------------------------------------------------------------ */
interface ExplorerSceneProps {
  mode: BrainMode;
  selectedRegion: RegionId | null;
  activity: Partial<Record<RegionId, number>>;
  onSelectRegion: (id: RegionId | null) => void;
  onHoverRegion?: (id: RegionId | null) => void;
  quality: BrainQuality;
  qualityPref: QualityPref;
  reducedMotion: boolean;
}

function ExplorerCore({
  mode,
  selectedRegion,
  activity,
  onSelectRegion,
  onHoverRegion,
  quality,
  qualityPref,
  reducedMotion,
}: ExplorerSceneProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<RegionId | null>(null);
  const hoveredRef = useRef<RegionId | null>(null);
  const lastInteractRef = useRef(-10);
  const draggingRef = useRef(false);

  // Camera transition goal (active right after a selection change).
  const camGoalRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA.explorerStart),
    target: new THREE.Vector3(0, 0, 0),
  });

  const { data: pointData, glbAvailable, onSampled: handleGlbSampled } = useBrainPointData(quality.pointCount);

  const pointsGeo = useMemo(() => buildPointsGeometry(pointData), [pointData]);
  useEffect(() => () => pointsGeo.dispose(), [pointsGeo]);

  const connectionsGeo = useMemo(() => buildConnectionGeometries(), []);
  useEffect(() => {
    return () => {
      connectionsGeo.lines.dispose();
      connectionsGeo.pulses.dispose();
    };
  }, [connectionsGeo]);

  const pointsMatRef = useRef<THREE.ShaderMaterial>(null);

  const shaderArgs = useMemo(() => {
    const uniforms = createBrainUniforms(quality.dpr, quality.tier, POINTS_SIZE.explorer, 1);
    const base = { uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    return {
      points: { ...base, vertexShader: brainPointsVertex, fragmentShader: brainPointsFragment },
      connLines: { ...base, vertexShader: connectionVertex, fragmentShader: connectionLineFragment },
      connPulses: { ...base, vertexShader: connectionVertex, fragmentShader: connectionPulseFragment },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update camera transition whenever selection changes
  useEffect(() => {
    if (!selectedRegion) {
      camGoalRef.current.pos.set(...CAMERA.explorerStart);
      camGoalRef.current.target.set(0, 0, 0);
      camGoalRef.current.active = true;
      return;
    }
    const view = REGION_VIEWS[selectedRegion];
    const anchor = REGION_ANCHORS[selectedRegion];
    const groupQuat = groupRef.current?.quaternion ?? new THREE.Quaternion();
    // Pick the hemisphere facing the camera for symmetric lateral regions.
    const localCam = camera.position.clone().applyQuaternion(groupQuat.clone().invert());
    const side = localCam.x < -0.05 ? -1 : 1;
    const focus = new THREE.Vector3(anchor[0] * side, anchor[1], anchor[2]).applyQuaternion(groupQuat);
    const dir = new THREE.Vector3(view.dir[0] * side, view.dir[1], view.dir[2])
      .normalize()
      .applyQuaternion(groupQuat);

    camGoalRef.current.target.copy(focus).multiplyScalar(0.32);
    camGoalRef.current.pos.copy(camGoalRef.current.target).addScaledVector(dir, view.distance);
    camGoalRef.current.active = true;
  }, [selectedRegion, camera]);

  // Cursor management
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  const setHoveredRegion = useCallback(
    (id: RegionId | null) => {
      if (hoveredRef.current === id) return;
      hoveredRef.current = id;
      setHovered(id);
      onHoverRegion?.(id);
    },
    [onHoverRegion],
  );

  // Reusable scratch objects for proxy raycasting
  const handleProxyOver = useCallback(
    (region: RegionId) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHoveredRegion(region);
    },
    [setHoveredRegion],
  );

  const handleProxyOut = useCallback(
    (region: RegionId) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (hoveredRef.current === region) setHoveredRegion(null);
    },
    [setHoveredRegion],
  );

  const handleProxyClick = useCallback(
    (region: RegionId) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelectRegion(selectedRegion === region ? null : region);
    },
    [onSelectRegion, selectedRegion],
  );

  useFrame((state, delta) => {
    const uniforms = pointsMatRef.current?.uniforms as BrainUniforms | undefined;
    if (!uniforms) return;
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uPixelRatio.value = quality.dpr;
    uniforms.uQuality.value = quality.tier === "high" ? 1 : 0;
    uniforms.uMotion.value = reducedMotion ? 0 : 1;

    // 1. Damped mode weights
    const targetModeX = mode === "anatomy" ? 1 : 0;
    const targetModeY = mode === "functional" ? 1 : 0;
    const targetModeZ = mode === "activity" ? 1 : 0;
    uniforms.uModeW.value.x = dampValue(uniforms.uModeW.value.x, targetModeX, CAMERA.dampLambda, dt);
    uniforms.uModeW.value.y = dampValue(uniforms.uModeW.value.y, targetModeY, CAMERA.dampLambda, dt);
    uniforms.uModeW.value.z = dampValue(uniforms.uModeW.value.z, targetModeZ, CAMERA.dampLambda, dt);

    // 2. Damped selection, hover, and activity arrays
    const selIdx = selectedRegion ? regionIndex(selectedRegion) : -1;
    const hovIdx = hoveredRef.current ? regionIndex(hoveredRef.current) : -1;
    uniforms.uSelected.value = selIdx;
    uniforms.uHovered.value = hovIdx;
    uniforms.uAnySelected.value = dampValue(uniforms.uAnySelected.value, selIdx >= 0 ? 1 : 0, CAMERA.dampLambda, dt);

    for (let i = 0; i < REGION_SLOTS; i++) {
      uniforms.uSelectW.value[i] = dampValue(uniforms.uSelectW.value[i], i === selIdx ? 1 : 0, CAMERA.dampLambda, dt);
      uniforms.uHoverW.value[i] = dampValue(uniforms.uHoverW.value[i], i === hovIdx ? 1 : 0, CAMERA.dampLambda * 1.4, dt);
      const id = REGION_IDS[i];
      const actTarget = id ? THREE.MathUtils.clamp(activity[id] ?? 0, 0, 1) : 0;
      uniforms.uActivity.value[i] = dampValue(uniforms.uActivity.value[i], actTarget, CAMERA.dampLambda, dt);
    }

    // 3. Internal structures & cortex transparency
    const isInternalSel = selectedRegion ? INTERNAL_REGIONS.has(selectedRegion) : false;
    const targetInternalVis = isInternalSel ? 1.0 : mode === "anatomy" ? 0.58 : mode === "functional" ? 0.42 : 0.22;
    const targetCortexAlpha = isInternalSel ? 0.28 : mode === "anatomy" ? 0.72 : 1.0;
    uniforms.uInternalVis.value = dampValue(uniforms.uInternalVis.value, targetInternalVis, CAMERA.dampLambda, dt);
    uniforms.uCortexAlpha.value = dampValue(uniforms.uCortexAlpha.value, targetCortexAlpha, CAMERA.dampLambda, dt);

    // 4. Subtle pointer glow
    uniforms.uPointer.value.lerp(state.pointer, 1 - Math.exp(-8 * dt));
    uniforms.uPointerAmt.value = dampValue(uniforms.uPointerAmt.value, hoveredRef.current ? 0.55 : 0.2, 6, dt);

    // 5. Idle rotation (stops on interaction, resumes after 4s; off for reduced motion or active selection)
    if (
      groupRef.current &&
      !reducedMotion &&
      !draggingRef.current &&
      !selectedRegion &&
      t - lastInteractRef.current > CAMERA.idleResumeSec
    ) {
      groupRef.current.rotation.y += CAMERA.idleSpeed * dt;
    }

    // 6. Camera easing on selection / deselection
    if (camGoalRef.current.active && controlsRef.current) {
      if (reducedMotion) {
        camera.position.copy(camGoalRef.current.pos);
        controlsRef.current.target.copy(camGoalRef.current.target);
        camGoalRef.current.active = false;
      } else {
        const k = 1 - Math.exp(-CAMERA.cameraDamp * dt);
        camera.position.lerp(camGoalRef.current.pos, k);
        controlsRef.current.target.lerp(camGoalRef.current.target, k);
        if (
          camera.position.distanceTo(camGoalRef.current.pos) < 0.015 &&
          controlsRef.current.target.distanceTo(camGoalRef.current.target) < 0.01
        ) {
          camGoalRef.current.active = false;
        }
      }
      controlsRef.current.update();
    }
  });

  const labelRegion = hovered ?? selectedRegion;
  const labelPos = useMemo<[number, number, number] | null>(() => {
    if (!labelRegion) return null;
    const a = REGION_ANCHORS[labelRegion];
    return [a[0], a[1] + 0.14, a[2]];
  }, [labelRegion]);

  return (
    <>
      <OptionalGlbLoader enabled={glbAvailable} pointCount={quality.pointCount} onSampled={handleGlbSampled} />
      <FpsGovernor qualityPref={qualityPref} tier={quality.tier} downgrade={quality.downgrade} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        enablePan={false}
        minDistance={CAMERA.minDistance}
        maxDistance={CAMERA.maxDistance}
        rotateSpeed={0.65}
        zoomSpeed={0.85}
        onStart={() => {
          draggingRef.current = true;
          camGoalRef.current.active = false;
        }}
        onEnd={() => {
          draggingRef.current = false;
          lastInteractRef.current = -1;
        }}
      />

      <IdleTimerSync
        draggingRef={draggingRef}
        lastInteractRef={lastInteractRef}
      />

      <group ref={groupRef}>
        <points geometry={pointsGeo} frustumCulled={false}>
          <shaderMaterial ref={pointsMatRef} args={[shaderArgs.points]} />
        </points>
        <lineSegments geometry={connectionsGeo.lines} frustumCulled={false}>
          <shaderMaterial args={[shaderArgs.connLines]} />
        </lineSegments>
        <points geometry={connectionsGeo.pulses} frustumCulled={false}>
          <shaderMaterial args={[shaderArgs.connPulses]} />
        </points>

        {/* Hidden low-poly region proxies for fast, accurate hover & click raycasting */}
        {REGION_PROXIES.map((proxy, idx) => (
          <mesh
            key={`${proxy.region}-${idx}`}
            position={proxy.center}
            scale={proxy.radii}
            onPointerOver={handleProxyOver(proxy.region)}
            onPointerOut={handleProxyOut(proxy.region)}
            onClick={handleProxyClick(proxy.region)}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}

        {labelRegion && labelPos ? (
          <Html position={labelPos} center distanceFactor={6} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap rounded-full border border-white/15 bg-[#0C1222]/90 px-2.5 py-1 text-[11px] font-medium text-[#E6EAF5] shadow-lg backdrop-blur-md">
              {REGION_NAME[labelRegion]}
            </div>
          </Html>
        ) : null}
      </group>

      {quality.postprocessing ? (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.92}
            luminanceSmoothing={0.28}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.24} darkness={0.52} />
        </EffectComposer>
      ) : null}
    </>
  );
}

/** Keeps `lastInteractRef` aligned with Three's `clock.elapsedTime` after drag end. */
function IdleTimerSync({
  draggingRef,
  lastInteractRef,
}: {
  draggingRef: React.MutableRefObject<boolean>;
  lastInteractRef: React.MutableRefObject<number>;
}) {
  useFrame(({ clock }) => {
    if (draggingRef.current || lastInteractRef.current === -1) {
      lastInteractRef.current = clock.elapsedTime;
    }
  });
  return null;
}

export function BrainExplorerCanvas(
  props: ExplorerSceneProps & { active: boolean; onContextLost: () => void },
) {
  const { active, onContextLost, onSelectRegion, quality, ...rest } = props;

  return (
    <Canvas
      dpr={quality.dpr}
      frameloop={active ? "always" : "demand"}
      camera={{ position: CAMERA.explorerStart, fov: CAMERA.fov, near: 0.05, far: 30 }}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: true }}
      onPointerMissed={() => onSelectRegion(null)}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost();
        });
      }}
      className="h-full w-full"
    >
      <color attach="background" args={["#060913"]} />
      <ExplorerCore
        {...rest}
        onSelectRegion={onSelectRegion}
        quality={quality}
      />
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/* HERO CONTENT                                                        */
/* ------------------------------------------------------------------ */
interface HeroSceneProps {
  progress: number;
  interactive: boolean;
  quality: BrainQuality;
  reducedMotion: boolean;
}

const HERO_KEYFRAMES = {
  startPos: new THREE.Vector3(0.0, 0.75, 5.2),
  midPos: new THREE.Vector3(2.05, 0.55, 2.25),
  endPos: new THREE.Vector3(0.06, -0.06, 0.24),
  startTarget: new THREE.Vector3(0, 0, 0),
  endTarget: new THREE.Vector3(0.28, -0.2, -0.14), // inside cortex looking at hippocampus & amygdala
} as const;

function HeroCore({ progress, interactive, quality, reducedMotion }: HeroSceneProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dampedProgRef = useRef(progress);
  const camPosScratch = useRef(new THREE.Vector3());
  const lookAtScratch = useRef(new THREE.Vector3());

  const { data: pointData, glbAvailable, onSampled } = useBrainPointData(quality.pointCount);
  const pointsGeo = useMemo(() => buildPointsGeometry(pointData), [pointData]);
  useEffect(() => () => pointsGeo.dispose(), [pointsGeo]);

  const matRef = useRef<THREE.ShaderMaterial>(null);
  const shaderArgs = useMemo(
    () => ({
      vertexShader: brainPointsVertex,
      fragmentShader: brainPointsFragment,
      uniforms: createBrainUniforms(quality.dpr, quality.tier, POINTS_SIZE.hero, progress),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state, delta) => {
    const uniforms = matRef.current?.uniforms as BrainUniforms | undefined;
    if (!uniforms) return;
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uPixelRatio.value = quality.dpr;
    uniforms.uQuality.value = quality.tier === "high" ? 1 : 0;
    uniforms.uMotion.value = reducedMotion ? 0 : 1;

    const p = THREE.MathUtils.clamp(progress, 0, 1);
    dampedProgRef.current = reducedMotion ? p : dampValue(dampedProgRef.current, p, 5.5, dt);
    const dp = dampedProgRef.current;

    // Converge nebula -> brain between 0.05 and 0.65, then fly inside 0.65 -> 1.0
    const converge = THREE.MathUtils.smoothstep(dp, 0.02, 0.65);
    const dive = THREE.MathUtils.smoothstep(dp, 0.6, 1.0);

    uniforms.uProgress.value = converge;
    uniforms.uTint.value = THREE.MathUtils.lerp(0.85, 0.12, converge);
    uniforms.uModeW.value.set(1 - dive * 0.4, dive * 0.4, 0);
    uniforms.uInternalVis.value = THREE.MathUtils.lerp(0.35, 1.0, dive);
    uniforms.uCortexAlpha.value = THREE.MathUtils.lerp(0.9, 0.34, dive);

    // Camera path
    const camPos = camPosScratch.current;
    if (dp < 0.62) {
      const k = THREE.MathUtils.smoothstep(dp, 0, 0.62);
      camPos.lerpVectors(HERO_KEYFRAMES.startPos, HERO_KEYFRAMES.midPos, k);
    } else {
      const k = THREE.MathUtils.smoothstep(dp, 0.62, 1.0);
      camPos.lerpVectors(HERO_KEYFRAMES.midPos, HERO_KEYFRAMES.endPos, k);
    }

    const lookAt = lookAtScratch.current.lerpVectors(
      HERO_KEYFRAMES.startTarget,
      HERO_KEYFRAMES.endTarget,
      dive,
    );

    if (interactive && !reducedMotion) {
      uniforms.uPointer.value.lerp(state.pointer, 1 - Math.exp(-6 * dt));
      uniforms.uPointerAmt.value = 0.45;
      camPos.x += state.pointer.x * (0.28 * (1 - dive * 0.6));
      camPos.y += state.pointer.y * (0.18 * (1 - dive * 0.6));
    } else {
      uniforms.uPointerAmt.value = 0;
    }

    camera.position.copy(camPos);
    camera.lookAt(lookAt);

    if (groupRef.current && !reducedMotion) {
      groupRef.current.rotation.y = Math.sin(t * 0.14) * 0.18 * (1 - dive * 0.7);
    }
  });

  return (
    <>
      <OptionalGlbLoader enabled={glbAvailable} pointCount={quality.pointCount} onSampled={onSampled} />
      <FpsGovernor qualityPref="auto" tier={quality.tier} downgrade={quality.downgrade} />
      <group ref={groupRef}>
        <points geometry={pointsGeo} frustumCulled={false}>
          <shaderMaterial ref={matRef} args={[shaderArgs]} />
        </points>
      </group>
      {quality.postprocessing ? (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.6} luminanceThreshold={0.9} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette eskil={false} offset={0.24} darkness={0.55} />
        </EffectComposer>
      ) : null}
    </>
  );
}

export function BrainHeroCanvas(
  props: HeroSceneProps & { active: boolean; onContextLost: () => void },
) {
  const { active, onContextLost, quality, ...rest } = props;

  return (
    <Canvas
      dpr={quality.dpr}
      frameloop={active ? "always" : "demand"}
      camera={{ position: [0, 0.75, 5.2], fov: CAMERA.fov, near: 0.04, far: 30 }}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost();
        });
      }}
      className="h-full w-full"
    >
      <color attach="background" args={["#060913"]} />
      <HeroCore {...rest} quality={quality} />
    </Canvas>
  );
}
