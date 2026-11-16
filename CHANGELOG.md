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

### Fixed
- **Offline font bundling**: Switched root layout from `next/font/google` to the local `geist` package (`geist/font/sans` and `geist/font/mono`), keeping `--font-geist-sans` and `--font-geist-mono` so builds need no network access.
- **Global reduced motion**: Moved `ReducedMotionProvider` to the root layout so `UserSettings.reducedMotion` applies consistently across the landing page, app shell, and 3D brain stages.
- **Quick Log deep-linking**: Expanded Quick Log targets to link directly to `#checkin`, `#sleep`, `#movement`, `#nutrition`, `#habits`, and `#mind`.
