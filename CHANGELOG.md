# Changelog

## v0.3.0 (2026-11-17)

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
