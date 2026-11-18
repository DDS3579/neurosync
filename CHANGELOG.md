# Changelog

## v0.3.0 (2026-11-17)

### Added
- **Immersive hardening, accessibility, Settings section & performance (`v0.3` polish)**:
  - **Performance & leak hygiene ([BrainScene.tsx](file:///c:/Projects/passion%5D/neurosync/src/features/brain/BrainScene.tsx), [useBrainQuality.ts](file:///c:/Projects/passion%5D/neurosync/src/features/brain/useBrainQuality.ts))**: moved `webglcontextlost` handling into a clean-unmount `<WebGLContextLossGuard>`, shared and explicitly disposed a single proxy geometry/material across region hit-meshes, disposed shader materials on unmount, and added testable `computeCappedDpr` and `shouldDowngradeFps` helpers.
  - **Floating panels & narrow-viewport resilience ([FloatingPanel.tsx](file:///c:/Projects/passion%5D/neurosync/src/components/floating/FloatingPanel.tsx), [panelLayout.ts](file:///c:/Projects/passion%5D/neurosync/src/components/floating/panelLayout.ts), [usePanelLayout.ts](file:///c:/Projects/passion%5D/neurosync/src/components/floating/usePanelLayout.ts), [BrainImmersivePanels.tsx](file:///c:/Projects/passion%5D/neurosync/src/features/brain/components/BrainImmersivePanels.tsx))**: re-clamps active pointer drags on mid-drag resize, rejects prototype keys & extreme dimensions in stored layouts, applies high-contrast opacity/borders, returns focus cleanly on close, and auto-collapses secondary panels on narrow desktop widths (`< 1180px` / `< 920px`).
  - **Accessibility & outer `ctrl+wheel` ([app-shell.tsx](file:///c:/Projects/passion%5D/neurosync/src/components/app-shell/app-shell.tsx), [BrainExplorer.tsx](file:///c:/Projects/passion%5D/neurosync/src/features/brain/BrainExplorer.tsx), [BrainExplorerWorkspace.tsx](file:///c:/Projects/passion%5D/neurosync/src/features/brain/components/BrainExplorerWorkspace.tsx))**: rescues keyboard focus if the shell turns `inert`, intercepts `Ctrl+wheel` across the entire immersive root while keeping panel scrolling native, enriches canvas `sr-only` context with logged activity counts, and adds debounced `aria-live="polite"` announcements for timeline scrubber day changes.
  - **Offline PWA shell coverage ([public/sw.js](file:///c:/Projects/passion%5D/neurosync/public/sw.js))**: added `/constellation` to `SHELL_URLS` and bumped cache namespaces to `neurosync-shell-v3` / `neurosync-assets-v3`.
  - **Settings & `axe-core` coverage ([SettingsWorkspace.tsx](file:///c:/Projects/passion%5D/neurosync/src/features/settings/components/SettingsWorkspace.tsx), [a11y.test.tsx](file:///c:/Projects/passion%5D/neurosync/src/__tests__/a11y.test.tsx))**: grouped **Brain Explorer** into its own Settings section (`Open the Brain Explorer in full-screen mode`, `Reset layout`, and `Reset size` showing current `×` scale), and expanded `pnpm test:a11y` to audit `/brain` (immersive), `/constellation` (Map + Table), and Focus Lab Microtasks.
- **Microtasks tab in Focus Lab (`/focus#microtasks`), Dexie v9, Experiment metrics & Library entries**:
  - Added `MicrotaskResult` domain model, Dexie `SCHEMA_VERSION = 9` migration (`microtaskResults: "id, date, task"`), `microtaskRepository`, `useMicrotaskResults`, and backup `schemaVersion` 9 import/export validation keeping v1–v8 backups compatible (`src/types/domain.ts`, `src/lib/db/dexie.ts`, `src/lib/db/backup.ts`, `src/lib/db/backup.test.ts`).
  - Added three calm, non-diagnostic microtasks (`src/features/focus/microtasks.ts`, `src/features/focus/components/microtasks/`):
    - **Reaction time**: random 1–4 s wait, `requestAnimationFrame` + `performance.now()` paint-synced timing, 5 trials, `< 100 ms` false-start note & retry, median and fastest trial summary.
    - **Memory span**: 3×3 grid sequence starting at length 3, `+1` on match, stopping after 2 misses at the same length, recording longest correct span with keyboard (`1–9`) and touch/mouse support.
    - **Attention (go/no-go)**: 40 trials (~75% Go cues), ~500 ms stimulus + 1000–1500 ms random gap, recording hits, misses, no-go commission errors, and mean Go reaction time.
  - Added first-run practice rounds (`ns:ui:v1:microtask-practice-done`), Cancel/`Esc`, auto time-of-day detection, optional 1–5 rested rating, auto-detected input method, reduced-motion / flashing-stimuli notices, and per-task Trends chart (`<MicrotaskTrendsCard>`) with median line and practice-effect caveat.
  - Extended Experiment Lab metrics (`reactionTime`, `memorySpan`) using per-day medians in `src/lib/insights/experiments.ts` (neutral `"faster"`/`"slower"`/`"longer"`/`"shorter"` wording and unit formatting in `ExperimentsWorkspace.tsx`), and added qualitative `reaction-time-variability` and `practice-effects` entries in `src/data/library.ts`.
  - Added logic and UI component tests in `src/features/focus/microtasks.test.ts`, `src/features/focus/components/microtasks/MicrotasksTab.test.tsx`, `src/lib/insights/experiments.test.ts`, and `src/lib/db/backup.test.ts`.
- **Constellation view (`/constellation`, `src/features/constellation/`)**:
  - Added `/constellation` (`Orbit` icon) to `NAV_GROUPS` in `src/components/app-shell/nav-items.ts` (automatically populating sidebar, topbar title, command palette `Ctrl+K`, and `/brain` immersive dock).
  - Built pure co-occurrence aggregation and deterministic force layout in `src/features/constellation/constellation.ts`: gathers non-archived habits (`done === true`), v0.2 `ActivityLog` types, `FocusSession` learning methods, `MovementLog` types, and `MindfulnessSession` types (no `goals` table exists); deduplicates per day across `14 / 30 / 90`-day windows; enforces a minimum 10-day gate (`MIN_CONSTELLATION_DAYS`) and `3+` shared-day edge threshold (`MIN_SHARED_DAYS`); and computes FNV-1a/Mulberry32 seeded settled positions that freeze at rest without external physics dependencies.
  - Built `<ConstellationCanvas>`, `<ConstellationDetailPanel>` (floating panel on desktop + bottom sheet above mobile nav via `mobileContainerClassName` on `<FloatingPanelLayer>` with stats, window mini-calendar, same-day links, and `"Log now"` shortcut), `<ConstellationTableView>` accessible table alternative, `<ConstellationWorkspace>`, and `src/app/(app)/constellation/page.tsx`.
  - Kept all copy strictly descriptive (`"happened on the same day N times"`, visible caveat banner, reduce-motion-safe twinkle, no streaks, no `"broken"` states, no causal wording, `"Load demo data"` gated strictly on empty data).
  - Added unit and UI component tests in `src/features/constellation/constellation.test.ts` and `src/features/constellation/components/constellationWorkspace.test.tsx`.
- **Brain Impact panel, Time Scrubber, and Quick Log panel (`src/features/brain/`)**:
  - Added pure timeline & impact helpers (`deriveBrainTimeline`, `rankLoggedActivitiesForImpact`, `getRegionImpactContributions`, `hasAnyBrainActivityData`) in `src/features/brain/brainActivity.ts` plus shader-uniform `activityRef` support in `BrainScene.tsx` and `BrainExplorer.tsx` so scrubbing updates brain region glow without React re-render storms.
  - Built `<BrainImpactPanel>` (floating bottom-right by default): ranks logged activities by total minutes with region-weight bars and click-to-highlight in overview mode; lists region contribution shares, minutes, and plain one-line educational explanations when a region is selected; gates `"Load demo data"` strictly on empty user history (`!hasAnyData`); and keeps `"Educational association, not a measurement of your brain activity."` visible.
  - Built `<BrainTimeScrubber>` (floating bottom-center, slim & collapsible): supports 7-day / 30-day windows, `"That day"` vs `"Cumulative"` accumulation modes, clickable 7-day ticks, step `<` / `>` buttons, and optional play animation (never autoplays; disabled when reduced motion is enabled).
  - Built `<BrainQuickLogPanel>` (floating top-left under Navigation dock, collapsed by default): logs personal activities, saves 1–5 quick mood check-ins (with `/habits#checkin` link), and links/logs focus sessions directly without leaving `/brain`, updating the brain glow immediately via Dexie live queries.
  - Added logic and component/integration tests in `src/features/brain/brainActivity.test.ts` and `src/features/brain/components/brainImpactPanels.test.tsx`.
- **Brain Explorer floating panel UI (`src/features/brain/components/BrainImmersivePanels.tsx`)**:
  - Replaced temporary fixed overlays in `/brain` immersive mode with three `<FloatingPanel>` panels inside `<FloatingPanelLayer>`:
    - **Navigation dock** (`brain-nav-dock`, top-left, collapsed to quick icon links by default): links to Overview, Daily Habits, Focus Lab, Planner, Brain Explorer (active), Insights, Experiments, Library, and Settings, plus Command Palette button (`Ctrl+K`), `"Reset layout"`, and `"Exit immersive"`.
    - **Modes & Controls panel** (`brain-mode-panel`, bottom-left on desktop, collapsed `<1024px`): Anatomy/Functional/Activity/Compare switcher, isolation toggle, cross-section controls & slider, `Fit` / `Reset` / `Brain size` slider, and persistent educational-association disclaimer in Activity and Compare modes.
    - **Region Details panel** (`brain-region-panel`, right side on desktop, collapsed `<1024px`): displays selected region name, description, common associations, **networks**, connected regions (fly-to chips), related activities (Compare chips), and logged activities summary — or a persistent `"Select a region"` hint + region picker when deselected.
  - Added `"Reset layout"` button under **Display & accessibility** in Settings (`SettingsWorkspace.tsx`) and `chipLabel` / `zIndexRange` polish so mobile (`390px`) chips fit cleanly and 3D labels stay behind open sheets.
- **Reusable floating panel system (`src/components/floating/`)**:
  - Built `<FloatingPanelLayer>` (`pointer-events: none` full-viewport overlay) and `<FloatingPanel>` (`role="region"` non-modal glassy cards, optional close/resize, collapse-to-chip, `data-brain-panel="true"` wheel isolation, internal body scroll, `Space`/`Enter` collapse, `Alt+Arrow` 16px keyboard move, `Esc` focus return to canvas, and reduced-motion support).
  - Added Zustand `usePanelLayout` store and pure layout engine (`src/components/floating/panelLayout.ts`, `usePanelLayout.ts`) with Pointer Events dragging (`translate3d` local DOM updates during drag), `12px` viewport clamping, `24px` edge/corner snapping, window `resize`/`orientationchange` re-clamping, z-order management, `resetPanelLayout()`, and validated `ns:ui:v1:panel-layout` `localStorage` persistence.
  - Added mobile (`<768px`) single-open bottom sheet stack with top handle and bottom chip row keeping the full-screen brain unobstructed above.
  - Added unit and component tests in `src/components/floating/panelLayout.test.ts` and `src/components/floating/FloatingPanel.test.tsx` (verified via a 3-placeholder-panel `/brain` demo, then removed placeholders ahead of control migration).
- **Immersive Brain-first `/brain` experience**:
  - Full-viewport (`100dvh x 100vw`, fixed, zero page scroll) immersive stage on `/brain` with dark space `#060913` backdrop and `Exit immersive` button + `Esc` (exits immersive only after isolation and region selection are cleared and no dialogs are open).
  - Hides `AppSidebar`, `AppTopbar`, `MobileNav`, and skip link via `hidden`, `inert`, and `aria-hidden` while keeping `AppShell` providers, `ReminderRunner`, `ServiceWorkerRegister`, and `OnboardingDialog` mounted (`src/components/app-shell/immersive-brain-context.tsx`, `src/components/app-shell/app-shell.tsx`).
  - Added `ns:ui:v1:brain-immersive` (default `true`) and `ns:ui:v1:brain-size` (default `1.0`, clamped `[0.5, 2.0]`) `localStorage` helpers (`src/lib/ui/brainUiPrefs.ts`) plus Settings toggle `"Open the Brain Explorer in full-screen mode"` (`src/features/settings/components/SettingsWorkspace.tsx`).
  - Added camera and size controls (`src/features/brain/brainControls.ts`, `BrainScene.tsx`, `BrainExplorerWorkspace.tsx`): plain wheel camera zoom, non-passive `ctrlKey`/trackpad-pinch brain scaling (`0.5x–2.0x` damped) that leaves wheel events over floating panels (`data-brain-panel="true"`) untouched, two-finger touch pinch zoom, bottom-right `Fit` / `Reset` / `Size` slider cluster, and keyboard shortcuts (`+`/`-`, `0`, `F`, arrow keys).
  - Kept `BrainExplorer` prop signatures backwards-compatible (`brainSize` and `cameraAction` optional), preserved single-mount WebGL across immersive/standard toggles, and added `ResizeObserver` `hasSize` guard in `useBrainStage` so rendering stays paused when hidden.
  - Added unit and integration tests in `src/lib/ui/brainUiPrefs.test.ts`, `src/features/brain/brainControls.test.ts`, and `src/__tests__/immersiveBrain.test.tsx`, plus forwarded `aria-label`/`aria-labelledby` to `SliderPrimitive.Thumb` in `src/components/ui/slider.tsx`.

### Changed
- **Workflow rules (`CLAUDE.md`)**: Updated `## Workflow (v0.3)` with `v0.3` branching guidance and added the rule that UI-only preferences live in `localStorage` under versioned keys (`ns:ui:v1:...`), wrapped in `try/catch` with safe defaults, rather than Dexie.
- **Dev-only route gating**: Verified `/dev-brain`, `/dev-overview`, and `/dev-ui` call `notFound()` when `process.env.NODE_ENV === "production"` and remain excluded from navigation, Command Palette, manifest, and service worker caches, backed by `src/__tests__/devRoutes.test.ts`.
- **Landing page initial JS slimming (`/`)**: Reduced initial JS on `/` from `317.3 KB` gzipped (`978.0 KB` raw across 19 scripts) to `184.4 KB` gzipped (`596.6 KB` raw across 8 scripts):
  - Isolated Dexie (`useSettings`), `motion/react` (`MotionConfig`), and Radix `TooltipProvider` to `src/app/(app)/layout.tsx`, replacing root-level sync with lightweight `A11yPrefsSync` + `ns:ui:v1:a11y` `localStorage` cache (`src/lib/ui/a11yPrefs.ts`).
  - Deferred GSAP/ScrollTrigger and Lenis (`src/features/landing/scrollEngine.ts`, `SmoothScroll.tsx`, `useScrollProgress.ts`, `DescentSection.tsx`) until first scroll interaction or hash navigation.
  - Dynamically imported below-the-fold sections (`InstrumentsSection`, `HonestScienceSection`, `ExperimentTeaserSection`, `PrivacySection`, `FinalCtaFooter`) via `next/dynamic` + `InViewSection`, kept `BrainHero` lazy (`ssr: false`) via direct module path with `BrainPoster`, extracted `LandingFooter`, and removed `cn` (`tailwind-merge`) from initial landing chunks.

## v0.2.0 (2026-11-17)

### Added
- **Workflow rules**: Added `## Workflow (v0.2)` to `CLAUDE.md` and initialized `CHANGELOG.md`.
- **Mind pillar (`/habits#mind`)**:
  - Guided breathing exercises (box breathing `4-4-4-4` and `4-7-8` patterns) and meditation timer with duration presets, reduced-motion support, and optional Web Audio soft chime (off by default).
  - Daily free-text journal supporting multiple entries per day, edit/delete, and local text search (never analysed, scored, or sent anywhere).
  - Daily gratitude log (1–3 lines per day) with a gentle "What went well?" prompt.
  - Added Mind & breathing links to the Quick Log sheet and Command Palette (`#mind`).
  - Wired `MindfulnessSession` records through the `mindfulness` `ActivityKind` into `deriveWeeklyBrainActivity` and Overview's daily brain preview.
  - Added conservative educational Library entry on paced breathing and stress ("not a substitute for professional help").
  - Added plain-language Settings note explaining that journal entries stay only in this browser and are included in JSON exports.
- **Dexie v2 migration & backup compatibility**:
  - Added Dexie `version(2)` with `mindfulnessSessions`, `journalEntries`, and `gratitudeEntries` tables plus settings `schemaVersion` upgrade migration.
  - Bumped backup `SCHEMA_VERSION` to `2` while continuing to validate and import `v0.1` (`schemaVersion: 1`) backups.
- **Activities beyond study (Pillar 6, `/habits#activities`)**:
  - Added `ActivityLog` domain type (`social`, `creative`, `music`, `language_learning`, `puzzles_games`, `new_hobby`, `novelty`) with duration, enjoyment rating (1–5), and optional note.
  - Extended `ActivityKind`, `ACTIVITY_META`, and `ACTIVITY_REGION_MAP` with conservative, hedged educational mappings for `puzzles_games`, `new_hobby`, and `novelty`, and updated `brainRegions.test.ts` to verify all 17 kinds.
  - Built `/habits#activities` tab with quick-add chips, weekly variety summary (counts only, no scores), and recent logs list; added `#activities` to Quick Log and Command Palette.
  - Wired `ActivityLog` entries into `deriveWeeklyBrainActivity` (Brain Explorer) and Overview's `brainActivity`.
  - Added `activity_variety` milestone and `study_without_recovery` reflection insight rules with unit tests.
  - Added Library entries on novelty, social connection, and hobbies.
  - Added Dexie `version(3)` (`activityLogs` table + upgrade migration) and backup `SCHEMA_VERSION = 3` with backwards-compatible import for `v1` and `v2` backups.
- **Deepened Focus Lab (`/focus`, `/focus#review`, `/focus#methods`)**:
  - Extended `FocusSession` with `practicedRetrieval` and `reviewedPrior` toggles at session completion and added Library links from method views (`/library#active-recall`, `#spaced-repetition`, `#interleaving`, `#deliberate-practice`).
  - Added Method stats view (`#methods`) showing session count, total minutes, average self-rated focus, average difficulty, sample sizes, and a plain self-reported small-sample caveat (no "best" rankings).
  - Added fixed-interval spaced-repetition Review queue (`#review`; 1, 3, 7, 14, 30 days) with easy/okay/hard scheduling, due-today list, one-tap "Start review session" timer prefill, and Command Palette shortcut.
  - Added `reading_without_retrieval` reflection insight rule for two-week deep reading without retrieval practice.
  - Added Dexie `version(4)` (`reviewItems` table + `focusSessions` sensible-default backfill) and backup `SCHEMA_VERSION = 4` keeping `v1`/`v2`/`v3` backup imports working.
- **"Your week" weekly report (`/insights/weekly`)**:
  - Extended `buildWeeklyReport()` with method breakdown, retrieval/review counts, Mind & Activities aggregations, 7-day daily series, brain-region intensity summary, and neutral week-over-week deltas while preserving backwards compatibility.
  - Built `/insights/weekly` (linked from Overview, Insights, and Command Palette) with previous/next week picker, highlights & reflection prompts, brain-activity summary strip with educational-association disclaimer, 6 chart/number sections with missing-data explanations, and client-side PNG download, Web Share API sharing (when supported), and print/PDF stylesheet (`Self-reported data from NeuroSync. Not a medical assessment.`).
- **Opt-in local reminders (`/settings` & in-app runner)**:
  - Added `ReminderSettings` (`windDown`, `checkin`, `reviewDue`, `quietHours`) to `UserSettings`, with Dexie `version(5)` migration and backup `SCHEMA_VERSION = 5` (preserving `v1`–`v4` imports).
  - Added Settings "Reminders" controls with per-reminder toggles and times, quiet hours, plain-language explanation of browser-without-push-server limits, permission requested only on toggle activation, and recurring `.ics` calendar export (`Add to calendar`).
  - Added `ReminderRunner` checking on load, `visibilitychange`, focus, and a 30s timer with per-slot deduplication, quiet-hours suppression, and warm, non-judgmental copy.
- **Rule-based Daily Schedule Planner (`/planner`)**:
  - Added deterministic rule-based planner (`generateDayPlan`) that places fixed commitments (flagging overlaps), strictly protects sleep and wind-down windows (including midnight-crossing schedules), prefers historically highest self-rated Focus Lab hours when sufficient history exists, splits study blocks with breaks and buffers, schedules movement and recovery pauses, and explains any unscheduled items without overpacking.
  - Added `/planner` route, sidebar & Command Palette nav entry, editable timeline blocks with time pickers, neutral study vs. recovery balance summary, `"Start this block"` Focus Lab prefill (`/focus?subject=...&plannedMin=...`), and IndexedDB save/load (`DayPlan` table, Dexie `version(6)`, backup `SCHEMA_VERSION = 6` preserving `v1`–`v5` imports).
- **Brain Explorer v0.2 upgrade (`/brain`)**:
  - Added Isolation mode toggle (smoothly fades non-selected regions, frames the isolated region, exits via `Esc` without breaking `BrainExplorerProps` compatibility).
  - Added Compare mode (`violet` vs `cyan` with luminous shared-overlap highlighting), two `ACTIVITY_META` pickers, side-by-side region breakdown, pure overlap computation (`compareActivities`) with Vitest coverage, plain-language summary, and persistent educational-association disclaimer.
  - Added Cross-section view supporting both segmented GLB clipping (`THREE.Plane`) and procedural particle cut planes across Axial Y, Sagittal X, and Coronal Z axes while preserving hippocampus & amygdala visibility inside the slice.
  - Upgraded Region panel `"Connected regions"` chips to fly the camera to the target region and `"Related activities"` chips to open Compare mode preselected.
- **Insight Engine v0.2 upgrade (`src/lib/insights`, `/insights`, `/overview`)**:
  - Added 6 neutral, minimum-sample, non-causal rules: `session_length_vs_focus`, `weekday_vs_weekend_pattern`, `outdoor_time_mood_energy`, `mindfulness_vs_stress`, `activity_variety_mood`, and 28-day `sleep_consistency_long_window`.
  - Added optional `confidence` (`low` / `moderate` / `enough` + plain one-line summary) on `Insight` and displayed it in `InsightCard`.
  - Added topic de-duplication, per-pillar and total caps in `computeInsights`, and `selectOverviewInsights` to surface at most one insight per pillar on `/overview`.
  - Added "Not useful" (dismiss) and 14-day snooze actions on `InsightCard` persisted via `InsightFeedback` (Dexie `version(7)`, backup `SCHEMA_VERSION = 7` preserving `v1`–`v6` imports), with restoration under **Insights → Dismissed**.
- **Accessibility & polish pass (app + landing page)**:
  - Upgraded `ChartCard` with visible text summaries and an accessible `"View as table"` / `"Chart"` toggle across Overview, Insights, and Weekly Report charts, plus non-color line/symbol distinction on `MoodChart`.
  - Added `highContrast` mode and `textSize` (`S` / `M` / `L`) settings (`UserSettings`, Dexie `version(8)`, backup `SCHEMA_VERSION = 8` keeping `v1`–`v7` imports), synced globally via `<html data-high-contrast data-text-size data-reduced-motion>` CSS custom properties and respected by the 3D brain shaders and overlays.
  - Added `"Skip to content"` links targeting `#main-content` across the app shell and landing page, top-level `<header>` / `<main>` / `<footer>` landmarks on the landing page, `min-w-0` overflow guards, focus-visible region selector bar and full state text alternative on `BrainExplorer`, and `aria-live` phase-only announcements on the breathing/meditation timer.
  - Audited and updated `--primary` / `--violet` (`#7C3AED`, `5.70:1` with white) and `--violet-text` (`#A78BFA`, `6.35:1`–`7.31:1`) for WCAG AA normal-text compliance.
  - Added automated `axe-core` + WCAG AA token audit suite (`pnpm test:a11y` / `src/__tests__/a11y.test.tsx`).
  - Added `(app)/error.tsx` route-segment error boundary with local reset and `/overview` recovery link.
- **Offline PWA shell & demo coverage**:
  - Updated `public/sw.js` (`neurosync-shell-v2` / `neurosync-assets-v2`) to pre-cache `/planner` and `/insights/weekly` alongside core routes.
  - Extended `loadDemoDataToDb` / `clearDemoDataFromDb` to populate and clean up v0.2 pillars (`mindfulnessSessions`, `journalEntries`, `gratitudeEntries`, `activityLogs`, `reviewItems`) alongside v0.1 demo logs.

### Fixed
- **Offline font bundling**: Switched root layout from `next/font/google` to the local `geist` package (`geist/font/sans` and `geist/font/mono`), keeping `--font-geist-sans` and `--font-geist-mono` so builds need no network access.
- **Global reduced motion**: Moved `ReducedMotionProvider` to the root layout so `UserSettings.reducedMotion` applies consistently across the landing page, app shell, and 3D brain stages.
- **Quick Log deep-linking**: Expanded Quick Log targets to link directly to `#checkin`, `#sleep`, `#movement`, `#nutrition`, `#habits`, and `#mind`.
