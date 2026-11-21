# NeuroSync v0.4 — Integration Report (Planner Connections)

Branch: `v0.4` · Date: 2026-11-21
This report covers the "planner connections" work pasted from the planning chat (Review, insights, Overview,
brain, calendar `.ics`, experiment template, Focus Lab handoff) and the audit items from the follow-up prompt.

Everything below was run on this machine. Where something could not be verified, it says so explicitly.

---

## 1. Verification evidence

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | Pass, 0 errors |
| Lint | `npx eslint src` | Pass, 0 errors / 0 warnings |
| Unit + integration tests | `npx vitest run` | Pass — 51 files, 407 tests |
| Accessibility suite | `npx vitest run src/__tests__/a11y.test.tsx` | Pass — 13 tests, 0 axe-core violations |
| Production build (webpack) | `npx next build --webpack` | Pass — 20 static routes, TypeScript clean |
| Production build (Turbopack, default) | `npx next build` | **Failed** — Turbopack panic: `Failed to write app endpoint /favicon.ico/route` … `intro.css.css [app-client] … creating new process` (see Known issues) |
| Browser walkthrough | — | **Not run** (no browser pass in this session) |

### Bundle sizes (webpack build, raw bytes on disk)

| Slice | Size |
| --- | --- |
| Root main chunks | 441.3 KiB |
| Shared `(app)` layout chunks | 53.8 KiB |
| `/planner` route chunks | 76.5 KiB |
| `/focus` route chunks | 94.5 KiB |
| `/overview` route chunks | 11.6 KiB |
| `/insights` route chunks | 48.9 KiB |
| All client chunks under `.next/static/chunks` | 4.18 MiB |

These are uncompressed on-disk sizes (not gzip/brotli transfer sizes). The planner route does not pull the
WebGL/brain chunks: `/brain` is 78.3 KiB and is only loaded on its own route, so the planner stays lean.

---

## 2. Audit table

| Area | Item | Status | Evidence |
| --- | --- | --- | --- |
| Functionality | Planned vs actual aggregation (by length bucket, by kind, sample sizes) | Done | `review/plannedVsActual.test.ts`, Review tab test, weekly report card test |
| Functionality | Four planner insight rules appended to `RULES` | Done | `lib/insights/plannerRules.test.ts`; extended `rules.test.ts` coverage fixtures |
| Functionality | Experiment template with 7 + 7 day windows | Done | `experimentTemplates.test.ts` (month/year/DST crossings) |
| Functionality | Overview next-block card + 4 command-palette actions | Done (unit-level) | `nextBlock.test.ts`, demo/overview tests |
| Functionality | `.ics` export (floating time, all-day transparent, folding) | Done | `calendar/ics.test.ts` incl. DST weeks |
| Functionality | `.ics` import (DTEND/DURATION, UTC, TZID, FREQ=DAILY) | Done | `calendar/parseIcs.test.ts` |
| Functionality | Provider → planner engine (external commitments) | Done | `calendar/providers.test.ts` |
| Functionality | Single completion path + Focus Lab `?blockId=` handoff | Done | `services/blockActions.test.ts` (real fake-indexeddb), idempotency test |
| Functionality | Brain minutes counted once (session + block ledger) | Done | `review/focusLedger.test.ts` proves 50m, not 100m |
| Performance | Planner route chunk size reported | Done | 76.5 KiB route + 53.8 KiB layout + 441.3 KiB root |
| Performance | Heavy-dataset profiling at 1440 / phone width | **Not measured** | No profiler/browser run this session |
| Performance | DnD code split to planner route | N/A | No drag-and-drop implementation exists in this tree |
| Accessibility | axe-core on `/planner` Today + Review, shutdown dialog | Done | `a11y.test.tsx` — 0 violations |
| Accessibility | Heading order in planner panels | Fixed | `h3` section headings promoted to `h2` (axe `heading-order`) |
| Accessibility | Live-region announcements for moves | Present | `role="status"` / `aria-live` in Today panel and shutdown dialog |
| Accessibility | Week board / Tasks screen axe coverage | N/A | Those screens do not exist in this tree (tabs are Today · Review · Day plan) |
| Copy | Banned-phrase scan (score / productivity / failed / behind / streak / guilt) | Clean | `grep` over planner, calendar, planner rules and templates; the one "streak" mention was rewritten |
| Copy | Review tab avoids scoring language | Fixed | Copy now says "no verdicts and no ranking of your days" |
| Data safety | Import v0.1–v0.4 backups | Done | `backup.test.ts` (schemaVersion 1, 2, 6, 7, 8, 9 → current) |
| Data safety | Corrupt block payload rejected atomically | Added | New test: invalid `plannedStart`/`taskId` block rejects, counts unchanged |
| Data safety | Replace import clears planner tables, no orphans | Added | New test: blocks/tasks/projects/dayPlanMeta cleared |
| Data safety | Demo data load/clear | Existing coverage | `demoData.test.ts`, overview demo tests |
| Privacy | No network calls in planner/calendar/planner rules | Verified | `grep` for `fetch(`, `axios`, `http(s)://` — no matches |
| Privacy | `.ics` import/export purely local | Verified | `parseIcs.ts` / `ics.ts` are pure string functions; no I/O |
| Privacy | Service worker shell includes `/planner` | Verified | `public/sw.js` shell list line 9 |
| Privacy | No third-party fonts/scripts | Verified | Layout imports the bundled `geist` package only |

---

## 3. Fixes made while pasting and verifying the chat code

1. **`placeBlockAt` missed overlap issues** — the engine attaches `block_overlap` to the earlier block in the
   pair, so the caller only inspected `issue.blockId === blockId`. It now also matches `issue.otherId`, which
   restores the intended rejection (unit test + UI test).
2. **Infinite render loop in `PlannerConnectionsShell`** — `useSyncExternalStore` returned a freshly parsed
   object on every read ("getSnapshot should be cached"). The snapshot is now memoised per hash string.
3. **`setState` inside effects** — the shutdown deep link and the shutdown dialog reset now use render-time
   state adjustment instead of `useEffect`, clearing the React 19 lint rule.
4. **`.ics` description folding split `Project: Thesis`** — project now leads the description, so 75-octet
   folding cannot break the label.
5. **Review copy contained the banned word "scores"** ("no scores and no ranking") — reworded.
6. **Contradictory template test** — it banned `\bcaused\b` while also requiring the caveat
   "does not show that block planning caused it". The ban now targets positive causal claims only
   (`will cause`, `will improve`), keeping the honest negation assertion.
7. **Shutdown dialog axe audit** needed a real `mousedown` for Radix tabs (automatic activation), not `.click()`.
8. **Unused imports/vars** removed (`settingsRepository` in `blockActions`, `Insight` type in `plannerRules`,
   destructured `settings` in `nextBlockHref`) so lint is clean.

---

## 4. Known issues (by severity)

**Medium**
- **Turbopack production build fails in this environment.** `next build` (default Turbopack) panics while
  spawning the CSS pipeline worker for `src/features/landing/intro/intro.css` and reports
  `Failed to write app endpoint /favicon.ico/route`. The webpack build (`next build --webpack`) succeeds, and
  the failure is in the landing-page intro CSS worker rather than the planner code. This looks environmental
  (child-process spawn in a path containing `]`), but it is unconfirmed and must be reproduced elsewhere before
  calling it environmental.

**Low**
- No browser walkthrough was performed, so the visual behaviour of the Today board, the Review charts at
  narrow widths, and the shutdown dialog at 360px are **unverified**.
- Heavy-dataset render profiling (40 tasks / 200 blocks / full week) was not run; no numbers are claimed.
- `NextBlockCard` and the weekly planned-vs-actual card are covered by unit tests only, not by a screenshot.
- Importing `.ics` remains session-scoped by design; nothing is persisted across reloads.

---

## 5. Suggestions for v0.5

1. **Drag-and-drop on the Today timeline** with keyboard and tap parity, loaded through a route-level dynamic
   import so the planner chunk stays near today's 76.5 KiB.
2. **Week board** (Mon–Sun columns, carry-over preview, balance hints) — the Review tab already has the data
   model for it.
3. **Persisted imported calendars** as a Dexie v11 table with a backup schema bump and migration tests, instead
   of session-scoped memory.
4. **A single "plan the day" flow** that turns today's tasks into blocks in one pass, including re-splitting
   after an overrun.
5. **Profile the planner with 200 blocks** and memoise the block rows; the board currently re-derives maps on
   every task/block change.
6. **Fix the Turbopack CSS worker failure** (or pin the build script to webpack) so CI matches local output.
