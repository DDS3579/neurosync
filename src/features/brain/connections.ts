/**
 * Neural connection arcs between `connectedTo` regions (from data/brainRegions).
 * One arc per hemisphere per pair; shared attributes feed a LineSegments (the arc)
 * and a Points layer (the travelling pulse head).
 */
import * as THREE from "three";

import { BRAIN_REGIONS } from "@/data/brainRegions";
import type { RegionId } from "@/types/domain";
import { REGION_ANCHORS, regionIndex } from "./regionZones";

/* TUNABLES */
export const ARC = {
  samples: 48, // vertices per arc
  inset: 0.86, // pull endpoints into the tissue
  inward: 0.55, // control point = midpoint * inward (arcs bow towards the centre, like tracts)
  lift: 0.14, // then lifted on +y so arcs read clearly
} as const;

export function buildConnectionPairs(): Array<[RegionId, RegionId]> {
  const seen = new Set<string>();
  const pairs: Array<[RegionId, RegionId]> = [];
  for (const region of BRAIN_REGIONS) {
    for (const other of region.connectedTo) {
      const key = [region.id, other].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([region.id, other]);
    }
  }
  return pairs;
}

function endpoint(id: RegionId, side: number, out: THREE.Vector3): THREE.Vector3 {
  const [x, y, z] = REGION_ANCHORS[id];
  return out.set(x * side, y, z).multiplyScalar(ARC.inset);
}

export function buildConnectionGeometries(): { lines: THREE.BufferGeometry; pulses: THREE.BufferGeometry } {
  const pairs = buildConnectionPairs();
  const n = ARC.samples;
  const total = pairs.length * 2 * n;
  const pos = new Float32Array(total * 3);
  const t = new Float32Array(total);
  const offset = new Float32Array(total);
  const pair = new Float32Array(total * 2);
  const index: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  const curve = new THREE.QuadraticBezierCurve3(a, c, b);
  let v = 0;
  let arc = 0;
  for (const [ra, rb] of pairs) {
    for (const side of [1, -1]) {
      endpoint(ra, side, a);
      endpoint(rb, side, b);
      c.addVectors(a, b).multiplyScalar(0.5 * ARC.inward);
      c.y += ARC.lift;
      const phase = (arc * 0.618034) % 1; // golden-ratio spread so pulses don't sync
      for (let i = 0; i < n; i++) {
        const tt = i / (n - 1);
        curve.getPoint(tt, p);
        pos[v * 3] = p.x; pos[v * 3 + 1] = p.y; pos[v * 3 + 2] = p.z;
        t[v] = tt;
        offset[v] = phase;
        pair[v * 2] = regionIndex(ra);
        pair[v * 2 + 1] = regionIndex(rb);
        if (i > 0) index.push(v - 1, v);
        v++;
      }
      arc++;
    }
  }
  const attrs: Record<string, THREE.BufferAttribute> = {
    position: new THREE.BufferAttribute(pos, 3),
    aT: new THREE.BufferAttribute(t, 1),
    aOffset: new THREE.BufferAttribute(offset, 1),
    aPair: new THREE.BufferAttribute(pair, 2),
  };
  const lines = new THREE.BufferGeometry();
  const pulses = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(attrs)) {
    lines.setAttribute(name, attr);
    pulses.setAttribute(name, attr);
  }
  lines.setIndex(index);
  return { lines, pulses };
}
