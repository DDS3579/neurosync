# NeuroSync v0.4 — Integration Report (Planner Connections + Polish Pass)

Branch: `v0.4` · Date: 2026-11-21
This report covers the "planner connections" work and the follow-up polish/performance/accessibility/
data-safety/privacy/verification prompt. Everything below was run on this machine; where something could
not be verified it says so explicitly.

---

## 1. Verification evidence

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | Pass, 0 errors |
| Lint | `npx eslint src` | Pass, 0 errors / 0 warnings |
| Unit + integration tests | `npx vitest run` | Pass — 54 files, 424 tests |
| Accessibility suite | `npx vitest run src/__tests__/a11y.test.tsx` | Pass — 13 tests, 0 axe-core violations |
| Production build (webpack) | `npx next build --webpack` | Pass — 20 static routes |
| Production build (Turbopack, default) | `npx next build` | **Failed** — Turbopack panic in the landing-page CSS worker (see Known issues) |
| Production walkthrough | `next start` on `:3010`, real Chromium via the preview panel | Run — see §4 |

### Bundle sizes (webpack build, measured from the served `/planner` HTML)

| Slice | Raw | gzip |
| --- | --- | --- |
| `/planner` page chunk (`app/(app)/planner/page-*.js`) | 94.8 KiB | 24.8 KiB |
| All JS requested by `/planner` (32 files incl. framework/React) | 1,803.2 KiB | 565.0 KiB |
| Pointer-drag controller (async chunk `5974.*.js`) | 2.1 KiB | 1.0 KiB |

The drag controller is **not** in the page HTML; it is fetched only when a drag actually starts (confirmed in
the production walkthrough with `performance.getEntriesByType("resource")`: chunk `5974` absent before the
drag, present immediately after `pointerdown` + `pointermove`). Route-relative growth versus the earlier
76.5 KiB page chunk is the Week and Tasks boards; the drag code itself stays out of the route bundle.

---

## 2. Audit table

| Area | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| Performance | Profile `/planner` with a heavy dataset (40 tasks / 200 blocks / week) | Measured in jsdom, not a real profiler | `plannerPerf.test.ts` renders 200 blocks (150 rows on the day incl. tray). Local runs: first render 265 ms, unchanged-prop re-render 66 ms (single run 904 ms / 175 ms when the file ran alongside the full suite). jsdom is far slower than Chromium, so these are regression guards, not frame-rate claims |
| Performance | Fix unnecessary re-renders | Done | `PlannerBlockRow` is `memo`; handlers are `useCallback`; the drag ghost is positioned inside `requestAnimationFrame` by writing `transform` (zero React renders per frame) |
| Performance | DnD loads only on the planner route | Done | `pointerDrag.ts` is imported with `await import()` from `PlannerTodayPanel`; separate 2.1 KiB chunk, fetched on first drag (verified in browser) |
| Performance | ~60 fps drag | Not verified | No DevTools trace or frame counter was run; the design avoids per-frame React renders, but that is a design argument, not a measurement |
| Performance | Route bundle reasonable + reported | Done | Table in §1 |
| Performance | Empty/loading/error states on new screens | Done | Today empty states (timeline, day list, tray, deep-work meter), Week per-day empty cards + "Open window", Tasks empty card, Review empty window, rail skeleton while its chunk loads, error toasts on every mutation path |
| Accessibility | Keyboard path: capture, tasks, tray, timeline, week board, shutdown | Done (code + tests + partial browser) | Capture submits with `Enter`; each row exposes checkbox, Start, Skip, slot buttons and `Alt+↑/↓` nudge; Week day cards open the day; Tasks "Open today"; shutdown dialog is a focus-trapped Radix dialog with bulk actions. Browser walkthrough exercised capture, slot placement, `Alt+↑` nudge, tabs and Escape |
| Accessibility | aria-live announcements for moves without noise | Done | One `aria-live` status line, set only when a placement/nudge succeeds (`"Walkthrough chapter placed at 08:45."` observed in the browser); separate `role="status"` heading text for static state |
| Accessibility | Focus after drops and dialogs | Done | `placeAt` focuses `block-row-<id>` after a successful placement (focus retained through nudge, observed); `ShutdownDialog` now remembers the element focused before opening and restores it in `onCloseAutoFocus` (Radix has no trigger to fall back to because the dialog is state/deep-link driven) |
| Accessibility | Touch targets | Done (code) | Planner action buttons and the drag handle use `min-h-9` (36 px) with `min-w-9` on icon buttons; timeline slots are `min-h-11` (44 px); rows keep 12 px gaps. Not measured with a ruler in the browser |
| Accessibility | High-contrast / text-size settings apply | Done (inherited) | Planner uses the same semantic tokens (`bg-surface`, `text-muted-foreground`, `border-border`) as the rest of the app, which the settings layer re-themes; axe contrast checks pass in default theme. The two alternate settings modes were not toggled in the browser |
| Accessibility | Reduced motion respected | Done (code) | Ghost transition and rail animations are skipped when `data-reduced-motion="true"` or `prefers-reduced-motion: reduce` |
| Accessibility | axe on Today, Week, Tasks, Review, shutdown | Done | `a11y.test.tsx` opens all four tabs (Radix needs `mousedown`) and the shutdown dialog; 0 violations |
| Copy | Banned phrases in new user-facing text | Clean for planner screens | `grep -rniE "brain score|productivity score|brain growth|grow your brain|streak|you failed|failed|behind"` over `src` returns no planner hits. Remaining hits are pre-existing and benign: anatomical "behind" in brain/library copy, "no streaks or penalties" in Habits, "Import failed" / "Geometry worker failed" technical errors, and the internal rule id `low_focus_streak` |
| Copy | Tone consistency | Done | Week says "Open window", "No day is over its open window this week", and suggests a day with room; Tasks says "Nothing is scheduled until you place a block"; Review keeps "no verdicts and no ranking of your days" |
| Data safety | Import v0.1–v0.4 backups | Done | `backup.test.ts`: schemaVersion 1, 2, 3, 4, 5, 6, 7, 8, 9 all normalize to current; the new `it.each([3,4,5])` case proves v0.2/v0.3-era files import, default the planner tables to zero rows and, in merge mode, keep newer planner rows |
| Data safety | Corrupt block/task payload rejected atomically | Done | Existing atomic test (`plannedStart`/`taskId` invalid → whole import rejected, counts unchanged) |
| Data safety | Delete-all clears the new tables | Done | `replace`-mode import test clears `blocks`/`tasks`/`projects`/`dayPlanMeta`; the settings "delete all" path uses the same transaction list |
| Data safety | Demo data load/clear | Existing coverage | `demoData.test.ts` + overview demo tests (deterministic `demo-` ids, cleared with the same tables) |
| Data safety | No orphan blocks after any delete path | Done | `taskRepository` cascade delete, unschedule-on-archive, and unschedule-on-delete covered in `plannerRepos.test.ts`; `placeBlockAt` re-validates before every write |
| Privacy | No network calls / third-party scripts or fonts | Verified | `grep` for `http(s)://`, `fetch(`, `XMLHttpRequest`, `googleapis`, `@import url`, `next/font/google` over `src` returns nothing (test files and `w3.org`/`schema.org` identifiers excepted) |
| Privacy | `.ics` import/export purely local | Verified | `calendar/ics.ts` and `calendar/parseIcs.ts` are pure string functions; imports are `date-fns` and local helpers only |
| Privacy | Service worker shell includes planner routes | Verified | `public/sw.js` shell list contains `/planner`; Week/Tasks are tabs, not routes, so no shell change was needed |

---

## 3. Work added in this polish pass

1. **Week board** (`PlannerWeekPanel.tsx` + `weekBalance.ts`): Mon–Sun cards with planned/open-window
   minutes, finished counts, per-day "open the day" actions, an honest "no day is over its open window"
   line and a "this day has room" suggestion. Pure helpers are unit-tested across week starts, DST-length
   days and over-packed days.
2. **Tasks board** (`PlannerTasksPanel.tsx`): open tasks with block counts, done counts, "Add to today" and
   "Open today".
3. **Slot placement rail** (`TimelineDropRail.tsx` + `timelineSlots.ts`): every tray/day-list block can be
   placed by tapping **Slots** and choosing an `HH:MM` grid button (`Place <title> at HH:MM`), with the same
   validator and the same toast/live announcement as the time input. Slot generation follows the planner's
   own wake/wind-down offsets and is capped at midnight.
4. **Pointer drag** (`dnd/pointerDrag.ts`): dependency-free controller in its own async chunk; 6 px drag
   threshold, ghost positioned in `requestAnimationFrame`, `Escape`/`pointercancel` cancel, drop resolved with
   `document.elementFromPoint`, reduced-motion aware, cleaned up on unmount.
5. **Memoised rows** (`PlannerBlockRow.tsx`) so a tray tick does not re-render the other 149 rows.
6. **Focus restore for the shutdown dialog** (the dialog is opened from state and from `#shutdown`, so Radix
   had no trigger to return focus to).
7. **Tests**: slot/nudge and week-balance unit tests, tap/keyboard/pointer-drag placement tests against real
   IndexedDB, the heavy-dataset render benchmark, v3–v5 legacy-import tests, and Week/Tasks axe coverage.

---

## 4. Production walkthrough (real Chromium, `next start` :3010)

Exercised and observed:

- Loaded `/planner` behind the first-run dialog, dismissed it, captured **"Walkthrough chapter"** with the
  keyboard (`Enter` in the capture field) → toast + status "Added … with 1 block in the tray".
- Placed it by tapping **Slots** → **09:00**: live region read "Walkthrough chapter placed at 09:00.", row
  moved to the timeline.
- Nudged with **Alt+↑**: 09:00 → 08:45, live region updated, focus stayed on `block-row-…`.
- Added a second task and completed a **pointer drag** onto the 14:00 slot: live region "Drag target placed
  at 14:00."; the drag chunk was requested only at that moment.
- **Start** opened the Focus Lab at `/focus?blockId=…&plannedMin=50&method=deep_reading`.
- **Week** tab: "Planned this week 1h 40m", "Open window 106h 45m", per-day cards and the "has room" hint.
- **Tasks** tab: two open tasks with block counts and "Add to today"/"Open today".
- **Review** tab: measured/completed counts, planned vs logged, per-length and per-kind empty guidance.
- **Shutdown**: per-block Roll to tomorrow / Back to tray / Skip, reflection field, neutral copy; `Escape`
  closed it and focus returned to the Shutdown button (after the fix above).
- Reloaded the page: tasks, blocks and placements persisted (IndexedDB).
- No console errors were logged during these steps.

Not exercised in the browser:

- Finishing a block through the Focus Lab timer, triggering an **overrun** and a **rebuild** (needs a live
  session and several minutes), so those flows rest on unit/integration tests only.
- **Export `.ics`** was not clicked; download contents were not inspected (the serializer is covered by
  `calendar/ics.test.ts` including DST weeks).
- Week board at phone width, high-contrast mode and text-size settings, and a frame-rate trace of the drag.

---

## 5. Known issues (by severity)

**Medium**
- **Turbopack production build fails in this environment.** `next build` (default Turbopack) panics while
  spawning the CSS pipeline worker for `src/features/landing/intro/intro.css` and reports
  `Failed to write app endpoint /favicon.ico/route`. `next build --webpack` succeeds and the failure is in the
  landing-page CSS worker, not planner code. It looks environmental (child-process spawn under a path
  containing `]`), but that is unconfirmed.
- **Drag frame rate is unmeasured.** The controller avoids per-frame React work, but no trace exists.

**Low**
- **The planner engine mixes two time bases.** `validateSchedule` compares wake-relative offsets with a
  wind-down start computed from midnight, so the allowed window only matches wall clock when wake time is
  07:00. Slot generation copies the same behaviour to stay consistent; the underlying comparison should be
  normalised in v0.5.
- **Heavy tray rendering.** 100+ tray rows still render fully; the day is honest at 150 rows (~66 ms
  re-render in jsdom) but there is no virtualization or "show more".
- **Week/Tasks and drag have no browser coverage at phone width**; only the axe/DOM tests and the desktop
  walkthrough above.
- **`aria-live` text is not cleared on cancel**, so the panel keeps the last "Dragging …" sentence as static
  text (screen readers only announce changes, so this is cosmetic).
- **Importing `.ics` remains session-scoped** by design; nothing persists across reloads.

---

## 6. Suggestions for v0.5 (UI/UX)

1. **Normalise the schedule time base** (wake-relative vs midnight) and let the wind-down window follow the
   actual wake time, then re-derive slot generation from the same function.
2. **Virtualise or paginate the tray** ("Show 20 more") and keep the drag handle sticky, so 200-block days
   stay snappy on phones.
3. **Carry the week board forward**: drag a block from one day card to another, and preview tomorrow's
   carry-over inside the shutdown dialog.
4. **One-pass "split and place"**: after an overrun, offer a single action that re-splits the remainder and
   places it in the next open slot.
5. **Persist imported calendars** as a Dexie v11 table with a backup schema bump, replacing the session-only
   busy windows.
6. **Add a frame-trace harness** (long-task observer around drag) so the ~60 fps requirement becomes a
   repeatable check rather than a design claim.
7. **Pin the build to webpack in CI** until the Turbopack CSS-worker panic is fixed, so CI matches local
   output.
