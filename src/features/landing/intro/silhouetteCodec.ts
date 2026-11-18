/**
 * Compact zigzag base-32 delta codec for the 2D intro brain silhouette.
 * Kept minimal so the landing initial bundle adds negligible decoding overhead.
 */

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const REVERSE = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export const SILHOUETTE_GRID = 511;

export function encodeVarUint(n: number): string {
  let out = "";
  let v = n >>> 0;
  do {
    let chunk = v & 31;
    v >>>= 5;
    if (v > 0) chunk |= 32;
    out += ALPHABET[chunk];
  } while (v > 0);
  return out;
}

export function encodeZigZagDelta(n: number): string {
  const zz = n >= 0 ? n * 2 : -n * 2 - 1;
  return encodeVarUint(zz);
}

export interface DecodedSilhouette {
  count: number;
  xs: Float32Array;
  ys: Float32Array;
  regions: Uint8Array;
  regionCounts: Uint16Array;
}

export function decodeSilhouettePayload(payload: string, regionCount: number): DecodedSilhouette {
  const runs = payload.split("|");
  const decodedX: number[] = [];
  const decodedY: number[] = [];
  const decodedR: number[] = [];
  const regionCounts = new Uint16Array(regionCount);

  for (let r = 0; r < runs.length && r < regionCount; r++) {
    const run = runs[r];
    let idx = 0;
    let x = 0;
    let y = 0;

    const readZigZag = (): number => {
      let result = 0;
      let shift = 0;
      while (idx < run.length) {
        const code = run.charCodeAt(idx++);
        const val = code < 128 ? REVERSE[code] : -1;
        if (val < 0) break;
        result |= (val & 31) << shift;
        if ((val & 32) === 0) break;
        shift += 5;
      }
      return (result & 1) === 1 ? -((result >>> 1) + 1) : result >>> 1;
    };

    let pts = 0;
    while (idx < run.length) {
      x += readZigZag();
      y += readZigZag();
      decodedX.push(x / SILHOUETTE_GRID - 0.5);
      decodedY.push(y / SILHOUETTE_GRID - 0.5);
      decodedR.push(r);
      pts++;
    }
    regionCounts[r] = pts;
  }

  return {
    count: decodedX.length,
    xs: Float32Array.from(decodedX),
    ys: Float32Array.from(decodedY),
    regions: Uint8Array.from(decodedR),
    regionCounts,
  };
}
