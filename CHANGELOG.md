# Changelog

## v0.2 (In Progress)

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

### Fixed
- **Offline font bundling**: Switched root layout from `next/font/google` to the local `geist` package (`geist/font/sans` and `geist/font/mono`), keeping `--font-geist-sans` and `--font-geist-mono` so builds need no network access.
- **Global reduced motion**: Moved `ReducedMotionProvider` to the root layout so `UserSettings.reducedMotion` applies consistently across the landing page, app shell, and 3D brain stages.
- **Quick Log deep-linking**: Expanded Quick Log targets to link directly to `#checkin`, `#sleep`, `#movement`, `#nutrition`, `#habits`, and `#mind`.
