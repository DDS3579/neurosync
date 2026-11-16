# NeuroSync: frontend rules

Privacy-first, neuroscience-informed web app: 3D brain explorer + personal tracker + local rule-based insights.
Local-first (Dexie), no backend, no accounts, no analytics, no AI API.

## Read first (source of truth, don't redefine)
- src/types/domain.ts: all shared types
- src/features/brain/* and src/components/nx/*: stubs define the exported component names and props. Keep those signatures unchanged; replace the internals.
- src/data/brainRegions.ts: region info and activity mapping

## Your lane
You own: src/features/brain, src/features/landing, src/components/nx, src/components/app-shell, src/features/overview,
src/app/globals.css, src/app/(marketing), src/app/(app)/layout.tsx.
Do NOT touch: src/lib/db, src/lib/insights, src/data, repositories, page data-wiring. UI is presentational and props-driven.

## Hard rules
1. Scientific honesty: never imply habits measure or grow the brain, or give a "brain score". Region links are educational associations.
   In activity mode show: "Educational association, not a measurement of your brain activity."
2. No network calls, no third-party scripts or fonts (next/font only).
3. Warm, non-judgmental copy. No shaming, no streak pressure.
4. Accessibility: keyboard paths, AA contrast, prefers-reduced-motion respected, no hover-only content.
5. Performance: WebGL is lazy-loaded (next/dynamic, ssr:false); pause rendering when hidden; no layout shift.

## Design tokens
bg #060913, surface #0C1222, surface-2 #111A30, border rgba(255,255,255,.08), violet #8B5CF6, cyan #22D3EE,
text #E6EAF5, muted #8A93AD. Geist Sans + Mono. Cyan = information, violet = emphasis. Color means something; don't glow everything.

## 3D coordinates
x +right, y +up, z +front. Brain normalized to about [-1,1].