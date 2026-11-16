# NeuroSync

**An observatory for your inner universe.**  
NeuroSync is a privacy-first, local-first web app combining an interactive 3D brain atlas, low-friction daily tracking, deterministic pattern observations, and personal N-of-1 experiments. Everything lives in your browser (`IndexedDB`) with no accounts, no analytics, and no external AI APIs.

---

## Setup & Scripts

Requires **Node.js 20+** and **pnpm**:

```bash
pnpm install
pnpm dev          # Start local dev server (http://localhost:3000)
pnpm build        # Production build (requires network on first run for next/font/google)
pnpm start        # Serve production build
pnpm typecheck    # TypeScript check (tsc --noEmit)
pnpm lint         # ESLint across src/
pnpm test         # Vitest unit & Dexie (fake-indexeddb) test suite
```

---

## Architecture Overview

```text
src/
├── app/
│   ├── (marketing)/        # Public observatory landing page + dynamic OpenGraph image
│   ├── (app)/              # Authenticated-free local workspace routes (thin hook containers)
│   │   ├── overview/       # Today status, 7-day charts, top 3 insights, brain activity preview
│   │   ├── habits/         # Check-in, Sleep, Movement, Nutrition, and user-defined Habits
│   │   ├── focus/          # Timestamp-driven focus timer + session log
│   │   ├── insights/       # Pillar-grouped observations + Weekly report
│   │   ├── experiments/    # Personal baseline vs. intervention experiments
│   │   ├── brain/          # Full 3D Brain Explorer + 7-day activity association panel
│   │   ├── library/        # Searchable educational reading list with caveats
│   │   └── settings/       # Preferences, JSON export/import, delete-all
│   └── manifest.ts         # Native Next.js App Router PWA manifest
├── components/
│   ├── app-shell/          # Sidebar, topbar, mobile nav, command palette, onboarding, SW registrar
│   ├── nx/                 # Core design primitives (RatingInput, DurationInput, StatCard, etc.)
│   └── ui/                 # shadcn/ui primitives
├── data/                   # Static educational atlas (brainRegions.ts) & library entries (library.ts)
├── features/               # Feature-scoped UI workspaces, pure utilities, and WebGL scenes
└── lib/
    ├── db/                 # Dexie schema, React live hooks, repositories, JSON backup/restore
    └── insights/           # Deterministic rule engine, weekly report, experiment analyzer, demo data
```

**Data flow pattern**: Route pages under `src/app/(app)/*/page.tsx` stay thin—they subscribe to live Dexie queries via `src/lib/db/hooks.ts`, render skeletons while loading, and pass plain props and callbacks down to presentational workspace components in `src/features/*/components/`.

**Offline PWA**: Uses Next.js's native `src/app/manifest.ts` and a zero-dependency service worker (`public/sw.js`) that pre-caches app shell routes and serves immutable `/_next/static/` assets cache-first for offline resilience after the first visit.

---

## Swapping in a Real Brain GLB Model

By default, `BrainHero` and `BrainExplorer` generate a deterministic procedural 3D point cloud (`generateBrainPoints` in `src/features/brain/brainGeometry.ts`) so the app runs offline with zero extra asset fetches.

To sample points from a custom segmented 3D brain model instead:

1. Place your `.glb` file in `public/models/brain.glb` (normalized around `[-1, 1]` with `+x` right, `+y` up, `+z` front).
2. Set the environment variable:
   ```bash
   NEXT_PUBLIC_BRAIN_GLB_URL=/models/brain.glb
   ```
3. `BrainScene.tsx` automatically loads the asset via `useGLTF` inside a suspense/error boundary and samples surface points with `sampleBrainFromObject`, falling back seamlessly to the procedural cloud if unavailable.

---

## Repository Layer & Future Auth / Sync

All persistence passes through `src/lib/db/repositories/` (`createRepository<T>` in `base.ts`) and `src/lib/db/backup.ts`:

- UI components and pages **never** import `dexie` directly; they read via `lib/db/hooks.ts` and mutate via repositories.
- Every record implements `Base` (`id`, `createdAt`, `updatedAt`) with local `YYYY-MM-DD` day keys.
- `buildBackup()` / `importAll()` serialize and validate the entire schema (`SCHEMA_VERSION = 1`) via Zod.

Adding optional encrypted cloud sync or user accounts in a future version only requires implementing a sync adapter behind the repository interface (or shipping validated `BackupFile` diffs), without rewriting any UI component or insight rule.

---

## Scientific Honesty & Privacy Principles

- **Educational associations, never measurements**: NeuroSync never gives a "brain score," never claims habits "grew" or "strengthened" brain regions, and never diagnoses anything. Every activity-linked brain view displays: *"Educational association, not a measurement of your brain activity."*
- **Non-judgmental reflection**: No streaks, guilt framing, or calorie/macro counting.
- **Honest local storage**: All logs stay in browser `IndexedDB` with zero network requests, zero accounts, and zero third-party analytics. Data is **not encrypted** on your device—use **Settings → Export JSON** anytime to keep a personal backup.
