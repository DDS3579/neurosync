/// <reference lib="webworker" />

import {
  BRAIN_SEED,
  generateProceduralBrainPointsAsync,
} from "./proceduralBrainCore";

export interface GeometryWorkerRequest {
  count: number;
  seed?: number;
}

export type GeometryWorkerMessage =
  | { type: "progress"; placed: number; total: number }
  | {
      type: "done";
      count: number;
      positions: ArrayBuffer;
      normals: ArrayBuffer;
      regions: ArrayBuffer;
      seeds: ArrayBuffer;
      kinds: ArrayBuffer;
      folds: ArrayBuffer;
      scatter: ArrayBuffer;
    };

self.onmessage = async (event: MessageEvent<GeometryWorkerRequest>) => {
  const { count, seed = BRAIN_SEED } = event.data;
  const data = await generateProceduralBrainPointsAsync(count, seed, {
    chunkSize: 6000,
    yieldBetweenChunks: false,
    onProgress: (placed, total) => {
      const msg: GeometryWorkerMessage = { type: "progress", placed, total };
      self.postMessage(msg);
    },
  });

  const positions = data.positions.buffer as ArrayBuffer;
  const normals = data.normals.buffer as ArrayBuffer;
  const regions = data.regions.buffer as ArrayBuffer;
  const seeds = data.seeds.buffer as ArrayBuffer;
  const kinds = data.kinds.buffer as ArrayBuffer;
  const folds = data.folds.buffer as ArrayBuffer;
  const scatter = data.scatter.buffer as ArrayBuffer;

  const doneMsg: GeometryWorkerMessage = {
    type: "done",
    count: data.count,
    positions,
    normals,
    regions,
    seeds,
    kinds,
    folds,
    scatter,
  };

  self.postMessage(doneMsg, [
    positions,
    normals,
    regions,
    seeds,
    kinds,
    folds,
    scatter,
  ]);
};
