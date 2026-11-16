# Brain Explorer & Hero

Procedural, deterministic WebGL particle brain with optional segmented GLB override.

## Swapping in a real segmented GLB

1. Export a GLB in the contract coordinate frame: `+x` right, `+y` up, `+z` anterior (front).
2. Save it to `public/models/brain.glb`.
3. **(Optional) Explicit region meshes:** Name meshes (or parent nodes) after `RegionId` values (`prefrontal`, `parietal`, `temporal`, `occipital`, `cerebellum`, `hippocampus`, `amygdala`, case-insensitive substring match such as `Temporal_L` or `hippocampus.001`). Any mesh without a matching name falls back to the spatial zones in `regionZones.ts`.
4. **(Optional) Deep structures:** If `hippocampus` or `amygdala` meshes are present in the GLB, they are sampled directly with a 6x density boost so they read as bright internal clusters; otherwise procedural deep clusters are injected inside the sampled cortex.
5. Point the app at the file with `NEXT_PUBLIC_BRAIN_GLB_URL=/models/brain.glb` (`.env.local`) and reload. `BrainScene` then loads it with `useGLTF` + `MeshSurfaceSampler` and replaces the procedural cloud.

When the variable is unset — the default — the procedural cloud is used and **no request is made**, so a missing model never produces a 404 in the console.
