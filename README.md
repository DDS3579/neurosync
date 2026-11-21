# NeuroSync

**An observatory for your inner universe.**  
NeuroSync is a privacy-first, local-first web app combining an interactive 3D brain atlas, low-friction daily tracking, deterministic rule-based insights, spaced-repetition study review, daily balance planning, and personal N-of-1 experiments. Everything lives in your browser (`IndexedDB`) with no accounts, no analytics, and no external AI APIs.

---

## Setup & Scripts

Requires **Node.js 20+** and **pnpm**:

```bash
pnpm install
pnpm dev          # Start local dev server (http://localhost:3000)
pnpm build        # Production Next.js build (use `pnpm exec next build --webpack` if Turbopack IPC is blocked)
pnpm start        # Serve production build
pnpm typecheck    # TypeScript check (tsc --noEmit)
pnpm lint         # ESLint across src/
pnpm test         # Vitest unit, Dexie (fake-indexeddb), and accessibility suite
pnpm test:a11y    # Automated axe-core + WCAG AA contrast token checks
```

> Fonts are bundled locally via the `geist` package (`geist/font/sans` and `geist/font/mono`), so builds do not require network access to Google Fonts.

---

## Architecture Overview

```text
src/
├── app/
│   ├── (marketing)/        # Public observatory landing page + dynamic OpenGraph image
│   ├── (app)/              # Local-first workspace routes (error boundary + skeleton fallbacks)
│   │   ├── overview/       # Today status, 7-day charts (with tables), top per-pillar insights, brain preview
│   │   ├── habits/         # Check-in, Sleep, Movement, Nutrition, Mind, Activities, and Custom Habits
│   │   ├── focus/          # Timestamp-driven focus timer, method stats, spaced-repetition review queue, and Microtasks (`#microtasks`)
│   │   ├── planner/        # Deterministic rule-based daily schedule & recovery-window planner
│   │   ├── insights/       # Confidence-rated observations, Dismiss/Snooze, plus `/insights/weekly` report
│   │   ├── experiments/    # Personal baseline vs. intervention N-of-1 experiments (ratings, focus, reaction time, memory span)
│   │   ├── brain/          # Full-screen immersive 3D Brain Explorer (floating panels, impact ranking, 7d/30d scrubber, quick log)
│   │   ├── constellation/  # Same-day habit/activity co-occurrence starfield map & accessible table (`>= 10` active days gate)
│   │   ├── library/        # Searchable educational reading list with conservative caveats
│   │   └── settings/       # Accessibility (S/M/L, HC, reduced motion), Brain Explorer prefs/resets, reminders + .ics, JSON backup
│   └── manifest.ts         # Native Next.js App Router PWA manifest
├── components/
│   ├── app-shell/          # Skip link, sidebar, topbar, mobile nav, command palette, onboarding, reminders, SW registrar
│   ├── floating/           # Draggable/collapsible glass FloatingPanel system (Zustand + Pointer Events + mobile bottom sheet)
│   ├── nx/                 # Core design primitives (ChartCard w/ table toggle, RatingInput, DurationInput, InsightCard, etc.)
│   └── ui/                 # shadcn/ui primitives
├── data/                   # Static educational atlas (brainRegions.ts) & library entries (library.ts)
├── features/               # Feature-scoped UI workspaces, pure utilities, and WebGL scenes
└── lib/
    ├── db/                 # Dexie v9 schema & migrations, live hooks, repositories, JSON backup/restore
    └── insights/           # Deterministic rule engine, confidence/dedupe/feedback, weekly report, demo data
```

**Data flow pattern**: Route pages under `src/app/(app)/*/page.tsx` stay thin — they subscribe to live Dexie queries via `src/lib/db/hooks.ts`, render route skeletons while loading, and pass plain props and callbacks down to presentational workspace components in `src/features/*/components/`. UI-only preferences (`immersive`, `brainSize`, floating panel layout) live in `localStorage` under `ns:ui:v1:...` keys rather than Dexie.

**Offline PWA**: Uses Next.js's native `src/app/manifest.ts` and a zero-dependency service worker (`public/sw.js`, `neurosync-shell-v3`) that pre-caches app shell routes (including `/planner`, `/insights/weekly`, and `/constellation`) and serves immutable `/_next/static/` assets cache-first for offline resilience after the first visit.

---

## Swapping in a Real Brain GLB Model

By default, `BrainHero` and `BrainExplorer` generate a deterministic procedural 3D point cloud (`generateBrainPoints` in `src/features/brain/brainGeometry.ts`) so the app runs offline with zero extra asset fetches.

To sample points from a custom segmented 3D brain model instead:

1. Place your `.glb` file in `public/models/brain.glb` (normalized around `[-1, 1]` with `+x` right, `+y` up, `+z` front).
2. Set the environment variable:
   ```bash
   NEXT_PUBLIC_BRAIN_GLB_URL=/models/brain.glb
   ```
3. `BrainScene.tsx` automatically loads the asset via `useGLTF` inside a suspense/error boundary and samples surface points with `sampleBrainFromObject`, falling back seamlessly to the procedural cloud if unavailable. Cross-section slicing works in both procedural and GLB modes.

---

## Repository Layer & Schema Migrations

All persistence passes through `src/lib/db/repositories/` (`createRepository<T>` in `base.ts`) and `src/lib/db/backup.ts`:

- UI components and pages **never** import `dexie` directly; they read via `lib/db/hooks.ts` and mutate via repositories.
- Every record implements `Base` (`id`, `createdAt`, `updatedAt`) with local `YYYY-MM-DD` day keys.
- `SCHEMA_VERSION = 10` covers all 21 Dexie tables (`settings`, `sleepLogs`, `checkins`, `focusSessions`, `movementLogs`, `nutritionLogs`, `habits`, `habitLogs`, `experiments`, `mindfulnessSessions`, `journalEntries`, `gratitudeEntries`, `activityLogs`, `reviewItems`, `dayPlans`, `insightFeedback`, `microtaskResults`, `projects`, `tasks`, `blocks`, `dayPlanMeta`).
- `buildBackup()` / `importAll()` serialize and validate backups via Zod while retaining full backwards-compatible migrations for `v0.1` (`schemaVersion: 1`) through `v9` backups. A corrupt block (for example `plannedStart` without `plannedDate`) rejects the whole import atomically.

**Planner connections (v0.4)**: `/planner` has three tabs — **Today** (capture a task, split it into blocks, place them on the timeline, start/skip/finish them), **Review** (planned vs logged minutes by block length and kind, always with sample sizes and a self-logged caveat) and **Day plan** (the rule-based generator, plus read-only busy time from an imported `.ics`). Finishing a timer records exactly one `FocusSession` and links it to the block, so brain and weekly totals never count a block twice. Export day/week as `.ics` with floating local wall-clock times; import is parsed locally and kept for the visit only. No new Dexie version was needed: `Block.actualMin/completedAt/focusSessionId` and `DayPlanMeta.shutdownDone/reflection` already existed at v10.

---

## Scientific Honesty & Privacy Principles

- **Educational associations, never measurements**: NeuroSync never gives a "brain score," never claims habits "grew" or "strengthened" brain regions, and never diagnoses anything. Every activity-linked brain view displays: *"Educational association, not a measurement of your brain activity."*
- **Non-judgmental reflection**: No streaks, guilt framing, or calorie/macro counting. Journal entries and gratitude notes are never analyzed, scored, or sent anywhere.
- **Honest browser limits & storage**: All logs stay in browser `IndexedDB` with zero network requests, zero accounts, and zero third-party analytics. Data is **not encrypted** on your device — use **Settings → Export JSON** anytime to keep a personal backup. Opt-in reminders explain clearly that browser apps without a push server cannot reliably fire alerts when closed, offering recurring `.ics` calendar export alongside active in-app notifications.


See `INTEGRATION_REPORT_v0.4.md` for the verification evidence, bundle sizes, known issues and v0.5 suggestions.