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
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

import { BRAIN_REGIONS } from "@/data/brainRegions";
import type { ActivityKind, RegionId } from "@/types/domain";
import {
  clampBrainSize,
  computeFitCameraDistance,
} from "./brainControls";
import type { BrainReadinessProgress } from "./BrainHero";
import { compareToSlotWeights } from "./brainCompare";
import {
  generateBrainPoints,
  generateBrainPointsNonBlocking,
  sampleBrainFromObject,
  type BrainPointData,
} from "./brainGeometry";
import { buildConnectionGeometries } from "./connections";
import {
  CUT_AXIS_DEFAULTS,
  INTERNAL_REGIONS,
  REGION_ANCHORS,
  REGION_IDS,
  REGION_PROXIES,
  REGION_SLOTS,
  REGION_VIEWS,
  matchRegionName,
  regionIndex,
  type BrainMode,
  type CrossSectionConfig,
} from "./regionZones";
import {
  brainPointsFragment,
  brainPointsVertex,
  connectionLineFragment,
  connectionPulseFragment,
  connectionVertex,
} from "./shaders/brainPoints";
import { FPS_GOVERNOR, shouldDowngradeFps, type BrainQuality, type QualityPref } from "./useBrainQuality";

/* ------------------------------------------------------------------ */
/* TUNABLES                                                            */
/* ------------------------------------------------------------------ */
/**
 * Optional segmented model. Unset (the default) keeps the procedural cloud and
 * makes no request at all — a probe for a missing asset would log a 404 on
 * every mount. Set NEXT_PUBLIC_BRAIN_GLB_URL to e.g. "/models/brain.glb".
 */
const GLB_URL = process.env.NEXT_PUBLIC_BRAIN_GLB_URL?.trim() || null;

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
  minDistance: 1.35,
  maxDistance: 6.5,
  idleResumeSec: 4.0,
  idleSpeed: 0.12, // rad/sec
  dampLambda: 7.5,
  cameraDamp: 4.5,
} as const;

export interface BrainCameraAction {
  type: "fit" | "reset" | "zoomIn" | "zoomOut" | "rotate";
  nonce: number;
  dx?: number;
  dy?: number;
}

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

function normalizeGlbForClipping(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z, 1e-6);

  const wrapper = new THREE.Group();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geo = (obj.geometry as THREE.BufferGeometry).clone();
    geo.applyMatrix4(obj.matrixWorld);
    geo.translate(-center.x, -center.y, -center.z);
    geo.scale(scale, scale, scale);
    let named: RegionId | null = null;
    for (let o: THREE.Object3D | null = obj; o && !named; o = o.parent) {
      named = matchRegionName(o.name);
    }
    const isDeep = named !== null && INTERNAL_REGIONS.has(named);
    const mat = new THREE.MeshStandardMaterial({
      color: isDeep ? "#22D3EE" : "#1E293B",
      emissive: isDeep ? "#0E7490" : "#0F172A",
      emissiveIntensity: isDeep ? 0.55 : 0.18,
      transparent: true,
      opacity: isDeep ? 0.85 : 0.38,
      roughness: 0.45,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: isDeep,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isDeep = isDeep;
    mesh.userData.region = named;
    wrapper.add(mesh);
  });
  return wrapper;
}

function GlbSampler({
  url,
  pointCount,
  onSampled,
}: {
  url: string;
  pointCount: number;
  onSampled: (data: BrainPointData, clippedGroup: THREE.Group) => void;
}) {
  const gltf = useGLTF(url);
  useEffect(() => {
    const sampled = sampleBrainFromObject(gltf.scene, pointCount);
    const clippedGroup = normalizeGlbForClipping(gltf.scene);
    onSampled(sampled, clippedGroup);
    return () => {
      clippedGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, [gltf.scene, pointCount, onSampled]);
  return null;
}

function useBrainPointData(pointCount: number) {
  const procedural = useMemo(() => generateBrainPoints(pointCount), [pointCount]);
  const [glbState, setGlbState] = useState<{
    data: BrainPointData;
    clippedGroup: THREE.Group;
  } | null>(null);
  const onSampled = useCallback((d: BrainPointData, clippedGroup: THREE.Group) => {
    setGlbState({ data: d, clippedGroup });
  }, []);
  const hasGlb = Boolean(glbState && glbState.data.count === pointCount);
  const data = hasGlb && glbState ? glbState.data : procedural;
  return {
    data,
    hasGlb,
    glbGroup: hasGlb && glbState ? glbState.clippedGroup : null,
    onSampled,
  };
}

function useBrainPointDataAsync(
  pointCount: number,
  onProgress?: (info: BrainReadinessProgress) => void,
) {
  const [proceduralState, setProceduralState] = useState<{
    count: number;
    data: BrainPointData;
  } | null>(null);
  const [glbState, setGlbState] = useState<{
    data: BrainPointData;
    clippedGroup: THREE.Group;
  } | null>(null);
  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const signal = { cancelled: false };
    onProgressRef.current?.({
      stage: "geometry",
      value: 0.05,
      pointsPlaced: 0,
      pointsTotal: pointCount,
    });
    void generateBrainPointsNonBlocking(pointCount, {
      signal,
      onProgress: (placed, total) => {
        if (!signal.cancelled) {
          onProgressRef.current?.({
            stage: "geometry",
            value: total > 0 ? placed / total : 1,
            pointsPlaced: placed,
            pointsTotal: total,
          });
        }
      },
    }).then((data) => {
      if (!signal.cancelled) {
        onProgressRef.current?.({
          stage: "geometry",
          value: 1,
          pointsPlaced: data.count,
          pointsTotal: data.count,
        });
        setProceduralState({ count: pointCount, data });
      }
    });
    return () => {
      signal.cancelled = true;
    };
  }, [pointCount]);

  const onSampled = useCallback((d: BrainPointData, clippedGroup: THREE.Group) => {
    setGlbState({ data: d, clippedGroup });
  }, []);

  const hasGlb = Boolean(glbState && glbState.data.count === pointCount);
  const procedural =
    proceduralState && proceduralState.count === pointCount ? proceduralState.data : null;
  const data = hasGlb && glbState ? glbState.data : procedural;

  return {
    data,
    hasGlb,
    glbGroup: hasGlb && glbState ? glbState.clippedGroup : null,
    onSampled,
  };
}

function OptionalGlbLoader({
  pointCount,
  onSampled,
}: {
  pointCount: number;
  onSampled: (data: BrainPointData, clippedGroup: THREE.Group) => void;
}) {
  if (!GLB_URL) return null;
  return (
    <GlbErrorBoundary>
      <Suspense fallback={null}>
        <GlbSampler url={GLB_URL} pointCount={pointCount} onSampled={onSampled} />
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
  uContrast: THREE.IUniform<number>;
  uModeW: THREE.IUniform<THREE.Vector3>;
  uSelected: THREE.IUniform<number>;
  uHovered: THREE.IUniform<number>;
  uSelectW: THREE.IUniform<number[]>;
  uHoverW: THREE.IUniform<number[]>;
  uActivity: THREE.IUniform<number[]>;
  uIsolateW: THREE.IUniform<number>;
  uCompareW: THREE.IUniform<number>;
  uCompareA: THREE.IUniform<number[]>;
  uCompareB: THREE.IUniform<number[]>;
  uCutW: THREE.IUniform<number>;
  uCutNormal: THREE.IUniform<THREE.Vector3>;
  uCutPos: THREE.IUniform<number>;
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
    uContrast: { value: 0 },
    uModeW: { value: new THREE.Vector3(1, 0, 0) },
    uSelected: { value: -1 },
    uHovered: { value: -1 },
    uSelectW: { value: new Array<number>(REGION_SLOTS).fill(0) },
    uHoverW: { value: new Array<number>(REGION_SLOTS).fill(0) },
    uActivity: { value: new Array<number>(REGION_SLOTS).fill(0) },
    uIsolateW: { value: 0 },
    uCompareW: { value: 0 },
    uCompareA: { value: new Array<number>(REGION_SLOTS).fill(0) },
    uCompareB: { value: new Array<number>(REGION_SLOTS).fill(0) },
    uCutW: { value: 0 },
    uCutNormal: { value: new THREE.Vector3(0, 1, 0) },
    uCutPos: { value: 1 },
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
      if (shouldDowngradeFps(fps, qualityPref, tier)) {
        s.tripped = true;
        downgrade();
      }
      s.frames = 0;
      s.windowSec = 0;
    }
  });

  return null;
}

/** Attaches and cleans up the `webglcontextlost` listener on the R3F canvas element. */
function WebGLContextLossGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLoss = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", handleLoss);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleLoss);
    };
  }, [gl, onContextLost]);
  return null;
}

/* ------------------------------------------------------------------ */
/* EXPLORER CONTENT                                                    */
/* ------------------------------------------------------------------ */
interface ExplorerSceneProps {
  mode: BrainMode;
  selectedRegion: RegionId | null;
  activity: Partial<Record<RegionId, number>>;
  activityRef?: RefObject<Partial<Record<RegionId, number>> | null>;
  onSelectRegion: (id: RegionId | null) => void;
  onHoverRegion?: (id: RegionId | null) => void;
  quality: BrainQuality;
  qualityPref: QualityPref;
  reducedMotion: boolean;
  highContrast?: boolean;
  isolated?: boolean;
  compare?: { activityA: ActivityKind; activityB: ActivityKind } | null;
  crossSection?: CrossSectionConfig | null;
  focusRequestKey?: number;
  onGlbStatusChange?: (hasGlb: boolean) => void;
  brainSize?: number;
  cameraAction?: BrainCameraAction | null;
}

const CUT_RING_ROTATION: Record<"x" | "y" | "z", [number, number, number]> = {
  x: [0, Math.PI / 2, 0],
  y: [-Math.PI / 2, 0, 0],
  z: [0, 0, 0],
};

function ExplorerCore({
  mode,
  selectedRegion,
  activity,
  activityRef,
  onSelectRegion,
  onHoverRegion,
  quality,
  qualityPref,
  reducedMotion,
  highContrast = false,
  isolated = false,
  compare = null,
  crossSection = null,
  focusRequestKey = 0,
  onGlbStatusChange,
  brainSize = 1,
  cameraAction = null,
}: ExplorerSceneProps) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const groupRef = useRef<THREE.Group>(null);
  const brainScaleRef = useRef(clampBrainSize(brainSize));
  const [hovered, setHovered] = useState<RegionId | null>(null);
  const hoveredRef = useRef<RegionId | null>(null);
  const lastInteractRef = useRef(-10);
  const draggingRef = useRef(false);
  const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 1));
  const localClipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 1));
  const targetCutNormalRef = useRef(new THREE.Vector3(0, 1, 0));

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

  const { data: pointData, hasGlb, glbGroup, onSampled: handleGlbSampled } = useBrainPointData(quality.pointCount);

  useEffect(() => {
    onGlbStatusChange?.(hasGlb);
  }, [hasGlb, onGlbStatusChange]);

  const compareTargets = useMemo(() => {
    if (mode !== "compare" && !compare) {
      return {
        weightsA: new Array<number>(REGION_SLOTS).fill(0),
        weightsB: new Array<number>(REGION_SLOTS).fill(0),
        involvesDeep: false,
      };
    }
    const actA = compare?.activityA ?? "deep_focus";
    const actB = compare?.activityB ?? "mindfulness";
    return compareToSlotWeights(actA, actB);
  }, [mode, compare]);

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

  const proxyGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const proxyMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  useEffect(() => {
    return () => {
      proxyGeo.dispose();
      proxyMat.dispose();
    };
  }, [proxyGeo, proxyMat]);

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

  // Update camera transition whenever selection, isolation, or explicit fly-to request changes
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

    const isIsolatedView = isolated;
    const scaleFactor = brainScaleRef.current;
    const targetScale = (isIsolatedView ? 0.58 : 0.36) * scaleFactor;
    const baseDist = isIsolatedView ? Math.max(1.32, view.distance * 0.72) : view.distance;
    const viewDistance = Math.min(
      CAMERA.maxDistance,
      Math.max(CAMERA.minDistance, baseDist * Math.max(0.75, scaleFactor * 0.92)),
    );

    camGoalRef.current.target.copy(focus).multiplyScalar(targetScale);
    camGoalRef.current.pos.copy(camGoalRef.current.target).addScaledVector(dir, viewDistance);
    camGoalRef.current.active = true;
  }, [selectedRegion, isolated, focusRequestKey, camera]);

  // Handle explicit camera controls (Fit to screen, Reset view, +/- zoom, arrow rotate)
  useEffect(() => {
    if (!cameraAction) return;
    const controls = controlsRef.current;
    const currentTarget = controls?.target ?? new THREE.Vector3(0, 0, 0);

    if (cameraAction.type === "reset") {
      if (groupRef.current) {
        groupRef.current.rotation.set(0, 0, 0);
      }
      camGoalRef.current.target.set(0, 0, 0);
      camGoalRef.current.pos.set(...CAMERA.explorerStart);
      camGoalRef.current.active = true;
      lastInteractRef.current = -1;
      return;
    }

    if (cameraAction.type === "fit") {
      const aspect = size.width / Math.max(1, size.height);
      const fitDist = computeFitCameraDistance(brainSize, aspect, CAMERA.fov);
      const dir = camera.position.clone().sub(currentTarget);
      if (dir.lengthSq() < 0.0001) {
        dir.set(...CAMERA.explorerStart);
      }
      dir.normalize();
      camGoalRef.current.target.set(0, 0, 0);
      camGoalRef.current.pos.copy(dir).multiplyScalar(fitDist);
      camGoalRef.current.active = true;
      lastInteractRef.current = -1;
      return;
    }

    if (cameraAction.type === "zoomIn" || cameraAction.type === "zoomOut") {
      const offset = (camGoalRef.current.active ? camGoalRef.current.pos : camera.position)
        .clone()
        .sub(currentTarget);
      const currentDist = Math.max(0.2, offset.length());
      const factor = cameraAction.type === "zoomIn" ? 0.84 : 1 / 0.84;
      const minD = isolated && selectedRegion ? 1.1 : CAMERA.minDistance;
      const nextDist = THREE.MathUtils.clamp(currentDist * factor, minD, CAMERA.maxDistance);
      offset.normalize().multiplyScalar(nextDist);
      camGoalRef.current.target.copy(currentTarget);
      camGoalRef.current.pos.copy(currentTarget).add(offset);
      camGoalRef.current.active = true;
      lastInteractRef.current = -1;
      return;
    }

    if (cameraAction.type === "rotate") {
      const offset = (camGoalRef.current.active ? camGoalRef.current.pos : camera.position)
        .clone()
        .sub(currentTarget);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += cameraAction.dx ?? 0;
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi + (cameraAction.dy ?? 0),
        0.18,
        Math.PI - 0.18,
      );
      offset.setFromSpherical(spherical);
      camGoalRef.current.target.copy(currentTarget);
      camGoalRef.current.pos.copy(currentTarget).add(offset);
      camGoalRef.current.active = true;
      lastInteractRef.current = -1;
    }
  }, [cameraAction, brainSize, camera, isolated, selectedRegion, size.width, size.height]);

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
    uniforms.uContrast.value = highContrast ? 1 : 0;

    // 1. Damped mode + compare weights (keep underlying base mode steady while crossfading compare)
    if (mode !== "compare") {
      const targetModeX = mode === "anatomy" ? 1 : 0;
      const targetModeY = mode === "functional" ? 1 : 0;
      const targetModeZ = mode === "activity" ? 1 : 0;
      uniforms.uModeW.value.x = dampValue(uniforms.uModeW.value.x, targetModeX, CAMERA.dampLambda, dt);
      uniforms.uModeW.value.y = dampValue(uniforms.uModeW.value.y, targetModeY, CAMERA.dampLambda, dt);
      uniforms.uModeW.value.z = dampValue(uniforms.uModeW.value.z, targetModeZ, CAMERA.dampLambda, dt);
    }
    uniforms.uCompareW.value = dampValue(uniforms.uCompareW.value, mode === "compare" ? 1 : 0, CAMERA.dampLambda, dt);

    // 2. Damped selection, hover, isolation, activity, and compare arrays
    const selIdx = selectedRegion ? regionIndex(selectedRegion) : -1;
    const hovIdx = hoveredRef.current ? regionIndex(hoveredRef.current) : -1;
    uniforms.uSelected.value = selIdx;
    uniforms.uHovered.value = hovIdx;
    uniforms.uAnySelected.value = dampValue(uniforms.uAnySelected.value, selIdx >= 0 ? 1 : 0, CAMERA.dampLambda, dt);
    uniforms.uIsolateW.value = dampValue(
      uniforms.uIsolateW.value,
      isolated && selIdx >= 0 ? 1 : 0,
      CAMERA.dampLambda,
      dt,
    );

    const activeMap = activityRef?.current ?? activity;
    for (let i = 0; i < REGION_SLOTS; i++) {
      uniforms.uSelectW.value[i] = dampValue(uniforms.uSelectW.value[i], i === selIdx ? 1 : 0, CAMERA.dampLambda, dt);
      uniforms.uHoverW.value[i] = dampValue(uniforms.uHoverW.value[i], i === hovIdx ? 1 : 0, CAMERA.dampLambda * 1.4, dt);
      const id = REGION_IDS[i];
      const actTarget = id ? THREE.MathUtils.clamp(activeMap[id] ?? 0, 0, 1) : 0;
      uniforms.uActivity.value[i] = dampValue(uniforms.uActivity.value[i], actTarget, CAMERA.dampLambda, dt);
      uniforms.uCompareA.value[i] = dampValue(uniforms.uCompareA.value[i], compareTargets.weightsA[i] ?? 0, CAMERA.dampLambda, dt);
      uniforms.uCompareB.value[i] = dampValue(uniforms.uCompareB.value[i], compareTargets.weightsB[i] ?? 0, CAMERA.dampLambda, dt);
    }

    // 2b. Cross-section cut plane
    const cutEnabled = Boolean(crossSection?.enabled);
    const cutAxis = crossSection?.axis ?? "y";
    const axisNormal = CUT_AXIS_DEFAULTS[cutAxis].normal;
    targetCutNormalRef.current.set(axisNormal[0], axisNormal[1], axisNormal[2]);
    if (reducedMotion) {
      uniforms.uCutW.value = cutEnabled ? 1 : 0;
      uniforms.uCutNormal.value.copy(targetCutNormalRef.current);
      uniforms.uCutPos.value = crossSection?.position ?? CUT_AXIS_DEFAULTS[cutAxis].defaultPos;
    } else {
      uniforms.uCutW.value = dampValue(uniforms.uCutW.value, cutEnabled ? 1 : 0, CAMERA.dampLambda, dt);
      uniforms.uCutNormal.value.lerp(targetCutNormalRef.current, 1 - Math.exp(-CAMERA.dampLambda * dt));
      if (uniforms.uCutNormal.value.lengthSq() > 0.001) uniforms.uCutNormal.value.normalize();
      uniforms.uCutPos.value = dampValue(
        uniforms.uCutPos.value,
        crossSection?.position ?? CUT_AXIS_DEFAULTS[cutAxis].defaultPos,
        CAMERA.dampLambda * 1.6,
        dt,
      );
    }

    // Update Three.js clipping plane when a segmented GLB mesh group is active
    if (cutEnabled && hasGlb && glbGroup && groupRef.current) {
      localClipPlaneRef.current.setComponents(
        -targetCutNormalRef.current.x,
        -targetCutNormalRef.current.y,
        -targetCutNormalRef.current.z,
        uniforms.uCutPos.value,
      );
      clipPlaneRef.current.copy(localClipPlaneRef.current).applyMatrix4(groupRef.current.matrixWorld);
      glbGroup.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mat = obj.material as THREE.MeshStandardMaterial;
        mat.clippingPlanes = obj.userData.isDeep ? null : [clipPlaneRef.current];
      });
    }

    // 3. Internal structures & cortex transparency
    const isInternalSel = selectedRegion ? INTERNAL_REGIONS.has(selectedRegion) : false;
    const targetInternalVis =
      isInternalSel || cutEnabled
        ? 1.0
        : mode === "compare"
          ? compareTargets.involvesDeep
            ? 0.95
            : 0.34
          : mode === "anatomy"
            ? 0.58
            : mode === "functional"
              ? 0.42
              : 0.22;
    const targetCortexAlpha = isInternalSel
      ? 0.28
      : cutEnabled
        ? 0.72
        : mode === "compare"
          ? 0.85
          : mode === "anatomy"
            ? 0.72
            : 1.0;
    uniforms.uInternalVis.value = dampValue(uniforms.uInternalVis.value, targetInternalVis, CAMERA.dampLambda, dt);
    uniforms.uCortexAlpha.value = dampValue(uniforms.uCortexAlpha.value, targetCortexAlpha, CAMERA.dampLambda, dt);

    // 4. Subtle pointer glow
    uniforms.uPointer.value.lerp(state.pointer, 1 - Math.exp(-8 * dt));
    uniforms.uPointerAmt.value = dampValue(uniforms.uPointerAmt.value, hoveredRef.current ? 0.55 : 0.2, 6, dt);

    // 5. Damped brain scale (Ctrl+wheel / slider 0.5x..2.0x) & idle rotation
    const targetBrainScale = clampBrainSize(brainSize);
    brainScaleRef.current = reducedMotion
      ? targetBrainScale
      : dampValue(brainScaleRef.current, targetBrainScale, CAMERA.dampLambda, dt);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(brainScaleRef.current);
      if (
        !reducedMotion &&
        !draggingRef.current &&
        !selectedRegion &&
        t - lastInteractRef.current > CAMERA.idleResumeSec
      ) {
        groupRef.current.rotation.y += CAMERA.idleSpeed * dt;
      }
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
      <OptionalGlbLoader pointCount={quality.pointCount} onSampled={handleGlbSampled} />
      <FpsGovernor qualityPref={qualityPref} tier={quality.tier} downgrade={quality.downgrade} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        enablePan={false}
        minDistance={isolated && selectedRegion ? 1.1 : CAMERA.minDistance}
        maxDistance={CAMERA.maxDistance}
        rotateSpeed={0.65}
        zoomSpeed={0.85}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
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

      {crossSection?.enabled && hasGlb && glbGroup ? (
        <>
          <ambientLight intensity={0.65} />
          <directionalLight position={[2, 3, 2]} intensity={0.85} />
        </>
      ) : null}

      <group ref={groupRef}>
        {crossSection?.enabled && hasGlb && glbGroup ? (
          <primitive object={glbGroup} />
        ) : null}

        <points geometry={pointsGeo} frustumCulled={false}>
          <shaderMaterial ref={pointsMatRef} args={[shaderArgs.points]} />
        </points>
        <lineSegments geometry={connectionsGeo.lines} frustumCulled={false}>
          <shaderMaterial args={[shaderArgs.connLines]} />
        </lineSegments>
        <points geometry={connectionsGeo.pulses} frustumCulled={false}>
          <shaderMaterial args={[shaderArgs.connPulses]} />
        </points>

        {/* Cross-section slice ring guide */}
        {crossSection?.enabled ? (
          <mesh
            position={[
              crossSection.axis === "x" ? crossSection.position : 0,
              crossSection.axis === "y" ? crossSection.position : 0,
              crossSection.axis === "z" ? crossSection.position : 0,
            ]}
            rotation={CUT_RING_ROTATION[crossSection.axis]}
            raycast={() => null}
          >
            <ringGeometry args={[1.0, 1.022, 64]} />
            <meshBasicMaterial
              color="#22D3EE"
              transparent
              opacity={0.28}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ) : null}

        {/* Hidden low-poly region proxies sharing one memoized geometry & material */}
        {REGION_PROXIES.map((proxy, idx) => {
          const disabledInIso = isolated && selectedRegion !== null && proxy.region !== selectedRegion;
          return (
            <mesh
              key={`${proxy.region}-${idx}`}
              geometry={proxyGeo}
              material={proxyMat}
              position={proxy.center}
              scale={proxy.radii}
              onPointerOver={disabledInIso ? undefined : handleProxyOver(proxy.region)}
              onPointerOut={disabledInIso ? undefined : handleProxyOut(proxy.region)}
              onClick={disabledInIso ? undefined : handleProxyClick(proxy.region)}
            />
          );
        })}

        {labelRegion && labelPos ? (
          <Html
            position={labelPos}
            center
            distanceFactor={6}
            zIndexRange={[10, 10]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className={
                highContrast
                  ? "whitespace-nowrap rounded-full border border-white/50 bg-[#02040A]/95 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-md"
                  : "whitespace-nowrap rounded-full border border-white/15 bg-[#0C1222]/90 px-2.5 py-1 text-[11px] font-medium text-[#E6EAF5] shadow-lg backdrop-blur-md"
              }
            >
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
      gl={{ antialias: false, powerPreference: "high-performance", alpha: true, localClippingEnabled: true }}
      onPointerMissed={() => onSelectRegion(null)}
      className="h-full w-full"
    >
      <color attach="background" args={["#060913"]} />
      <WebGLContextLossGuard onContextLost={onContextLost} />
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
  highContrast?: boolean;
  onProgress?: (info: BrainReadinessProgress) => void;
  onReady?: () => void;
}

const HERO_KEYFRAMES = {
  startPos: new THREE.Vector3(0.0, 0.75, 5.2),
  midPos: new THREE.Vector3(2.05, 0.55, 2.25),
  endPos: new THREE.Vector3(0.06, -0.06, 0.24),
  startTarget: new THREE.Vector3(0, 0, 0),
  endTarget: new THREE.Vector3(0.28, -0.2, -0.14), // inside cortex looking at hippocampus & amygdala
} as const;

function HeroCore({
  progress,
  interactive,
  quality,
  reducedMotion,
  highContrast = false,
  onProgress,
  onReady,
}: HeroSceneProps) {
  const { camera, gl, scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dampedProgRef = useRef(progress);
  const camPosScratch = useRef(new THREE.Vector3());
  const lookAtScratch = useRef(new THREE.Vector3());
  const shadersCompiledRef = useRef(false);
  const firstFrameQueuedRef = useRef(false);
  const readyEmittedRef = useRef(false);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onProgressRef.current = onProgress;
    onReadyRef.current = onReady;
  }, [onProgress, onReady]);

  const { data: pointData, onSampled } = useBrainPointDataAsync(quality.pointCount, onProgress);
  const pointsGeo = useMemo(
    () => (pointData ? buildPointsGeometry(pointData) : null),
    [pointData],
  );
  useEffect(() => () => pointsGeo?.dispose(), [pointsGeo]);

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

  // Asynchronous shader compilation once points geometry is mounted.
  useEffect(() => {
    if (!pointsGeo || shadersCompiledRef.current) return;
    let cancelled = false;
    onProgressRef.current?.({ stage: "shaders", value: 0.2 });

    const finishCompile = () => {
      if (cancelled) return;
      shadersCompiledRef.current = true;
      onProgressRef.current?.({ stage: "shaders", value: 1 });
    };

    const rendererWithAsync = gl as THREE.WebGLRenderer & {
      compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown>;
    };
    if (typeof rendererWithAsync.compileAsync === "function") {
      void rendererWithAsync.compileAsync(scene, camera).then(finishCompile, finishCompile);
    } else {
      gl.compile(scene, camera);
      finishCompile();
    }

    return () => {
      cancelled = true;
    };
  }, [pointsGeo, gl, scene, camera]);

  useFrame((state, delta) => {
    if (!pointsGeo) return;
    const uniforms = matRef.current?.uniforms as BrainUniforms | undefined;
    if (!uniforms) return;
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uPixelRatio.value = quality.dpr;
    uniforms.uQuality.value = quality.tier === "high" ? 1 : 0;
    uniforms.uMotion.value = reducedMotion ? 0 : 1;
    uniforms.uContrast.value = highContrast ? 1 : 0;

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

    // Fire firstFrame + onReady only after shader compilation, 2 presented rAFs, and document.fonts.ready.
    if (shadersCompiledRef.current && !firstFrameQueuedRef.current) {
      firstFrameQueuedRef.current = true;
      onProgressRef.current?.({ stage: "firstFrame", value: 0.4 });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const fontsReady =
            typeof document !== "undefined" && document.fonts?.ready
              ? document.fonts.ready
              : Promise.resolve();
          void fontsReady.then(() => {
            if (!readyEmittedRef.current) {
              readyEmittedRef.current = true;
              onProgressRef.current?.({ stage: "firstFrame", value: 1 });
              onReadyRef.current?.();
            }
          });
        });
      });
    }
  });

  return (
    <>
      <OptionalGlbLoader pointCount={quality.pointCount} onSampled={onSampled} />
      <FpsGovernor qualityPref="auto" tier={quality.tier} downgrade={quality.downgrade} />
      {pointsGeo ? (
        <group ref={groupRef}>
          <points geometry={pointsGeo} frustumCulled={false}>
            <shaderMaterial ref={matRef} args={[shaderArgs]} />
          </points>
        </group>
      ) : null}
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
      className="h-full w-full"
    >
      <color attach="background" args={["#060913"]} />
      <WebGLContextLossGuard onContextLost={onContextLost} />
      <HeroCore {...rest} quality={quality} />
    </Canvas>
  );
}
