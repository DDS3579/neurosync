# NeuroSync Integration Report

## 1. Contract Audit & Integration Summary

All route groups, domain types, repositories, insight rules, 3D brain stages, `nx` primitives, and landing modules were audited against `CLAUDE.md` and `src/types/domain.ts`:

- **Types & Exports**: `src/types/domain.ts`, `src/data/brainRegions.ts`, `src/data/library.ts`, `src/features/brain/index.ts`, `src/components/nx/index.ts`, `src/lib/insights/index.ts`, and `src/lib/db/repositories/index.ts` match expected signatures (`BrainHeroProps`, `BrainExplorerProps`, `OverviewViewProps`, `nx` primitives).
- **Stubs Removed**: Zero `TODO`, `FIXME`, or `stub` placeholders remain across `src/`.
- **Surgical Integration Fixes Applied**:
  1. **Dexie Boundary Encapsulation**: Removed direct `@/lib/db/dexie` imports from [src/features/overview/demoData.ts](src/features/overview/demoData.ts) and [src/app/(app)/settings/page.tsx](src/app/(app)/settings/page.tsx). Demo load and delete-all now route exclusively through `@/lib/db/backup` (`importAll`) and `@/lib/db/repositories`.
  2. **Repo-Wide ESLint Cleanliness**: Updated [src/components/app-shell/app-shell.tsx](src/components/app-shell/app-shell.tsx) and [src/hooks/use-mobile.ts](src/hooks/use-mobile.ts) to use `useSyncExternalStore` instead of synchronous `setState` inside `useEffect`.
  3. **Quick Log Routing**: Updated `"Check-in and sleep"` in `AppShell`'s `QUICK_LOG_TARGETS` from `/overview` to `/habits` so users land directly on the logging forms.
  4. **Data Safety Test Coverage**: Added a delete-all (`importAll` empty `"replace"`) test case in [src/features/settings/backupValidation.test.ts](src/features/settings/backupValidation.test.ts).

## 2. Wired Routes & Key Files

| Area | Files |
| :--- | :--- |
| **Marketing Landing** | `src/app/(marketing)/page.tsx`, `src/app/(marketing)/opengraph-image.tsx`, `src/features/landing/*` |
| **App Layout & Shell** | `src/app/(app)/layout.tsx`, `src/components/app-shell/app-shell.tsx`, `src/components/app-shell/onboarding-dialog.tsx`, `src/components/app-shell/service-worker-register.tsx` |
| **Overview** | `src/app/(app)/overview/page.tsx`, `src/features/overview/OverviewView.tsx`, `src/features/overview/demoData.ts` |
| **Daily Habits** | `src/app/(app)/habits/page.tsx`, `src/features/habits/components/*`, `src/features/checkin/checkinUtils.ts`, `src/features/sleep/sleepUtils.ts`, `src/features/movement/movementUtils.ts`, `src/features/nutrition/nutritionUtils.ts`, `src/features/habits/habitUtils.ts` |
| **Focus Lab** | `src/app/(app)/focus/page.tsx`, `src/features/focus/components/FocusWorkspace.tsx`, `src/features/focus/timerUtils.ts` |
| **Insights** | `src/app/(app)/insights/page.tsx`, `src/features/insights/components/InsightsWorkspace.tsx` |
| **Experiment Lab** | `src/app/(app)/experiments/page.tsx`, `src/features/experiments/components/ExperimentsWorkspace.tsx`, `src/features/experiments/experimentUtils.ts` |
| **Brain Explorer** | `src/app/(app)/brain/page.tsx`, `src/features/brain/components/BrainExplorerWorkspace.tsx`, `src/features/brain/brainActivity.ts` |
| **Library** | `src/app/(app)/library/page.tsx`, `src/features/library/components/LibraryWorkspace.tsx` |
| **Settings** | `src/app/(app)/settings/page.tsx`, `src/features/settings/components/SettingsWorkspace.tsx` |
| **PWA** | `src/app/manifest.ts`, `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png` |

## 3. Audit Results

| Audit | Status | Evidence |
| :--- | :--- | :--- |
| **TypeScript (`pnpm typecheck`)** | **PASS** | `tsc --noEmit` exited `0` across entire repo after final edit. |
| **Lint (`pnpm lint`)** | **PASS** | `eslint` exited `0` across entire repo (`0` errors, `0` warnings). |
| **Unit Tests (`pnpm test`)** | **PASS** | `vitest run` passed `12` test files, `142` tests (`backup`, `backupValidation`, `rules`, `weekly`, `experiments`, `experimentUtils`, `demo`, `stats`, `brainRegions`, `sleepUtils`, `timerUtils`, `checkinUtils`). |
| **Honesty** | **PASS** | Grep across `src/` found zero claims of brain scores, structure growth, IQ, or diagnoses (`HonestScienceSection` explicitly strikes through refused claims; `brainRegions.test.ts` content safety passes; `BrainExplorer`, `BrainExplorerWorkspace`, and `OverviewView` show `"Educational association, not a measurement of your brain activity."`). |
| **Privacy** | **PASS** | Grep across `src/` found zero `fetch(`, `XMLHttpRequest`, `sendBeacon`, `gtag`, or external analytics SDKs. `public/sw.js` handles same-origin requests only. Live browser Network tab capture was not run in the sandbox. |
| **Data Safety** | **PASS** | Automated Vitest suites verify `exportAll`/`importAll` round-trip, malformed/invalid backup rejection leaving tables untouched (`BackupError`), and empty `"replace"` wipe (`backup.test.ts`, `backupValidation.test.ts`). |
| **Performance (Static Audit)** | **PASS (Static)** | `BrainHero` and `BrainExplorer` are dynamically imported with `{ ssr: false }`. `useBrainStage` pauses `frameloop` via `visibilitychange` + `IntersectionObserver`. `BrainScene` disposes `BufferGeometry` on unmount. Bundle gzip measurement requires `next build` outside the offline sandbox. |
| **Accessibility (Static Audit)** | **PASS (Static)** | One `<h1>` per page, cyan `:focus-visible` outlines in `globals.css`, `RatingInput` roving `radiogroup`, keyboard region buttons in `BrainExplorer` & `BrainExplorerWorkspace`, `aria-live` announcements, and `prefers-reduced-motion` branches across landing + app. |
| **Production Build (`pnpm build`)** | **BLOCKED (Sandbox)** | Turbopack loader IPC (`evaluate_webpack_loader`) fails inside the Windows sandbox; `next build --webpack` compiles up to `next/font/google`, which fails offline (`ENOTFOUND fonts.googleapis.com`). |
| **Browser / Offline PWA / Lighthouse** | **BLOCKED (Sandbox)** | Network-disabled sandbox blocks loopback HTTP (`localhost`) and lacks Chromium/Playwright binaries, so live scroll, Network tab, offline reload, and Lighthouse scores remain unverified in-browser. |

## 4. Known Issues Ranked by Severity

1. **High — Unverified Production Build & Live Browser/PWA Pass (Environment Block)**: `pnpm build`, live `390px`/`1440px` scroll checks, offline Service Worker reload, and Lighthouse have not been executed outside the sandbox.
2. **Medium — Settings `reducedMotion` Preference Scope**: `SettingsWorkspace` persists `settings.reducedMotion` in IndexedDB, while `usePrefersReducedMotion()` in `useBrainQuality.ts` currently reads only the OS `(prefers-reduced-motion: reduce)` media query.
3. **Low — Habits Tab Deep-Linking**: `AppShell`'s Quick Log links to `/habits` and `/habits#habits`; `HabitsWorkspace` currently defaults to the `Check-in` tab without reading URL hash/query state.
4. **Low — Development Harness Routes Present**: `src/app/(app)/dev-brain`, `dev-overview`, and `dev-ui` remain in the app tree for visual inspection.

## 5. Prioritized Next Steps for v0.2

1. **Run Full Local Verification**: Execute `pnpm build && pnpm start` locally, verify `< 200KB` gzipped landing JS (excluding WebGL chunk), test offline reload via DevTools Application → Service Workers, and capture Lighthouse Performance/Accessibility/PWA scores.
2. **Wire `settings.reducedMotion` Globally**: Sync `UserSettings.reducedMotion` into a root attribute/context so the in-app toggle overrides animations identically to the OS media query.
3. **Deep-Link Habits Tabs & Quick Log**: Sync `HabitsWorkspace` active tab with `#checkin` / `#sleep` / `#movement` / `#nutrition` / `#habits` hash changes (without breaking Next 16 `cacheComponents`).
4. **Gate or Remove `dev-*` Harness Routes**: Strip or guard `/dev-brain`, `/dev-overview`, and `/dev-ui` behind `NODE_ENV !== "production"` before public deployment.
5. **Custom Segmented Brain Asset**: Provide a curated `brain.glb` via `NEXT_PUBLIC_BRAIN_GLB_URL` for higher anatomical fidelity over the procedural fallback.
