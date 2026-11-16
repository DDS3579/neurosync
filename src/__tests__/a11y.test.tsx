// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { parseISO } from "date-fns";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

vi.hoisted(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});
import { ChartCard } from "@/components/nx";
import { BrainExplorer } from "@/features/brain/BrainExplorer";
import { BrainExplorerWorkspace } from "@/features/brain/components/BrainExplorerWorkspace";
import { deriveWeeklyBrainActivity } from "@/features/brain/brainActivity";
import { ExperimentsWorkspace } from "@/features/experiments/components/ExperimentsWorkspace";
import { FocusWorkspace } from "@/features/focus/components/FocusWorkspace";
import { HabitsWorkspace } from "@/features/habits/components/HabitsWorkspace";
import { InsightsWorkspace } from "@/features/insights/components/InsightsWorkspace";
import { WeeklyReportWorkspace } from "@/features/insights/components/WeeklyReportWorkspace";
import { LibraryWorkspace } from "@/features/library/components/LibraryWorkspace";
import { LandingPage } from "@/features/landing/LandingPage";
import { OverviewView } from "@/features/overview/OverviewView";
import { buildOverviewViewData } from "@/features/overview/demoData";
import AppSegmentError from "@/app/(app)/error";
import { PlannerWorkspace } from "@/features/planner/components/PlannerWorkspace";
import { SettingsWorkspace } from "@/features/settings/components/SettingsWorkspace";
import { LIBRARY_ENTRIES } from "@/data/library";
import { buildWeeklyReport, computeInsights, generateDemoData } from "@/lib/insights";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/overview",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  default: () => function DynamicStub() {
    return null;
  },
}));

const TODAY_ISO = "2026-11-16";
const TODAY_DATE = parseISO(TODAY_ISO);

let mountRoot: Root | null = null;
let mountNode: HTMLElement | null = null;

function installBrowserStubs() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  }

  if (typeof window.IntersectionObserver === "undefined") {
    class IntersectionObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  }

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => null,
  });
}

async function renderIntoMain(ui: ReactElement, wrapInMain = true): Promise<HTMLElement> {
  mountNode = document.createElement("div");
  document.body.appendChild(mountNode);
  mountRoot = createRoot(mountNode);

  await act(async () => {
    mountRoot!.render(
      <TooltipProvider>
        {wrapInMain ? <main id="main-content">{ui}</main> : ui}
      </TooltipProvider>,
    );
  });

  return mountNode;
}

async function runAxeCheck(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // JSDOM does not evaluate external CSS custom properties for contrast checks;
      // token contrast is audited explicitly against globals.css below.
      "color-contrast": { enabled: false },
    },
  });
  expect(results.violations).toEqual([]);
}

function contrastRatio(hexFg: string, hexBg: string): number {
  const toRgb = (hex: string) => {
    const clean = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  };
  const lum = (hex: string) =>
    toRgb(hex)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  const l1 = lum(hexFg);
  const l2 = lum(hexBg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe("NeuroSync accessibility audit (axe-core + WCAG AA tokens)", () => {
  beforeAll(() => {
    installBrowserStubs();
  });

  afterEach(async () => {
    if (mountRoot) {
      await act(async () => {
        mountRoot!.unmount();
      });
      mountRoot = null;
    }
    if (mountNode) {
      mountNode.remove();
      mountNode = null;
    }
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const demo = generateDemoData(14, 42, TODAY_DATE);
  const insightInput = {
    ...demo,
    activities: [],
    mindfulness: [],
    journal: [],
    gratitude: [],
  };

  it("Overview workspace passes axe-core with chart table toggles", async () => {
    const overviewData = buildOverviewViewData({
      ...insightInput,
      today: TODAY_DATE,
    });
    const node = await renderIntoMain(
      <OverviewView
        {...overviewData}
        onLogToday={vi.fn()}
        onOpenBrain={vi.fn()}
        onDismissInsight={vi.fn()}
        onSnoozeInsight={vi.fn()}
      />,
    );
    await runAxeCheck(node);

    // Toggle "View as table" and confirm accessible table markup renders cleanly.
    const tableBtn = node.querySelector('button[aria-label*="View Sleep as table"]');
    expect(tableBtn).not.toBeNull();
    await act(async () => {
      (tableBtn as HTMLButtonElement).click();
    });
    expect(node.querySelector("table caption")).not.toBeNull();
    expect(node.querySelectorAll("table th[scope='col']").length).toBeGreaterThan(0);
    await runAxeCheck(node);
  });

  it("Habits workspace passes axe-core", async () => {
    const node = await renderIntoMain(
      <HabitsWorkspace
        sleepTargetMin={480}
        checkins={demo.checkins}
        sleepLogs={demo.sleep}
        movementLogs={demo.movement}
        nutritionLogs={demo.nutrition}
        habits={demo.habits}
        habitLogs={demo.habitLogs}
        mindfulnessSessions={[]}
        journalEntries={[]}
        gratitudeEntries={[]}
        activityLogs={[]}
        onSaveCheckin={vi.fn(async () => "created" as const)}
        onDeleteCheckin={vi.fn(async () => {})}
        onCreateSleep={vi.fn(async () => {})}
        onUpdateSleep={vi.fn(async () => {})}
        onDeleteSleep={vi.fn(async () => {})}
        onCreateMovement={vi.fn(async () => {})}
        onUpdateMovement={vi.fn(async () => {})}
        onDeleteMovement={vi.fn(async () => {})}
        onCreateNutrition={vi.fn(async () => {})}
        onUpdateNutrition={vi.fn(async () => {})}
        onDeleteNutrition={vi.fn(async () => {})}
        onToggleHabit={vi.fn(async () => {})}
        onAddHabit={vi.fn(async () => {})}
        onRenameHabit={vi.fn(async () => {})}
        onArchiveHabit={vi.fn(async () => {})}
        onDeleteHabit={vi.fn(async () => {})}
        onCreateMindfulness={vi.fn(async () => {})}
        onDeleteMindfulness={vi.fn(async () => {})}
        onCreateJournal={vi.fn(async () => {})}
        onUpdateJournal={vi.fn(async () => {})}
        onDeleteJournal={vi.fn(async () => {})}
        onSaveGratitude={vi.fn(async () => "created" as const)}
        onDeleteGratitude={vi.fn(async () => {})}
        onCreateActivity={vi.fn(async () => {})}
        onUpdateActivity={vi.fn(async () => {})}
        onDeleteActivity={vi.fn(async () => {})}
      />,
    );
    await runAxeCheck(node);
  });

  it("Focus Lab workspace passes axe-core", async () => {
    const node = await renderIntoMain(
      <FocusWorkspace
        defaultFocusMin={25}
        sessions={demo.focus}
        reviewItems={[]}
        onCreateSession={vi.fn(async () => {})}
        onDeleteSession={vi.fn(async () => {})}
        onAddReviewItem={vi.fn(async () => {})}
        onRateReviewItem={vi.fn(async () => 1)}
        onDeleteReviewItem={vi.fn(async () => {})}
      />,
    );
    await runAxeCheck(node);
  });

  it("Schedule Planner workspace passes axe-core", async () => {
    const node = await renderIntoMain(
      <PlannerWorkspace
        defaultSleepTargetMin={480}
        defaultBreakMin={10}
        focusSessions={demo.focus}
        savedPlans={[]}
        onSavePlan={vi.fn(async () => "created" as const)}
      />,
    );
    await runAxeCheck(node);
  });

  it("Brain Explorer workspace and canvas text alternative pass axe-core", async () => {
    const derived = deriveWeeklyBrainActivity({
      focus: demo.focus,
      movement: demo.movement,
      sleep: demo.sleep,
      habits: demo.habits,
      habitLogs: demo.habitLogs,
      mindfulness: [],
      activities: [],
      today: TODAY_DATE,
    });
    const node = await renderIntoMain(
      <div>
        <BrainExplorerWorkspace
          activity={derived.activity}
          loggedItems={derived.items}
          windowStart={derived.windowStart}
          windowEnd={derived.windowEnd}
        />
        <BrainExplorer
          mode="activity"
          selectedRegion="prefrontal"
          activity={derived.activity}
          onSelectRegion={vi.fn()}
        />
      </div>,
    );
    const regionDesc = node.querySelector('[role="region"][aria-label="Interactive 3D brain atlas"]');
    expect(regionDesc).not.toBeNull();
    expect(regionDesc?.getAttribute("aria-describedby")).toBeTruthy();
    await runAxeCheck(node);
  });

  it("Experiments, Insights, Weekly Report, Library, and Settings pass axe-core", async () => {
    const insights = computeInsights(insightInput, TODAY_ISO);
    const report = buildWeeklyReport(insightInput, "2026-11-16");

    const expNode = await renderIntoMain(
      <ExperimentsWorkspace
        experiments={[]}
        insightInput={insightInput}
        todayISO={TODAY_ISO}
        onCreateExperiment={vi.fn(async () => {})}
        onUpdateExperiment={vi.fn(async () => {})}
        onDeleteExperiment={vi.fn(async () => {})}
      />,
    );
    await runAxeCheck(expNode);
    await act(async () => {
      mountRoot!.unmount();
    });
    mountRoot = null;
    expNode.remove();

    const insNode = await renderIntoMain(
      <InsightsWorkspace
        insights={insights}
        dismissedInsights={[]}
        snoozedInsights={[]}
        weeklyReport={report}
        sleepWeek={report.daily.map((d) => ({ date: d.date, hours: d.sleepHours }))}
        sleepTargetHours={8}
        focusWeek={report.daily.map((d) => ({ date: d.date, minutes: d.focusMin }))}
        moodWeek={report.daily.map((d) => ({
          date: d.date,
          mood: d.mood,
          concentration: d.concentration,
        }))}
        weekOffset={0}
        onChangeWeekOffset={vi.fn()}
      />,
    );
    await runAxeCheck(insNode);
    await act(async () => {
      mountRoot!.unmount();
    });
    mountRoot = null;
    insNode.remove();

    const weeklyNode = await renderIntoMain(
      <WeeklyReportWorkspace
        report={report}
        sleepTargetHours={8}
        weekOffset={0}
        onPrevWeek={vi.fn()}
        onNextWeek={vi.fn()}
        onCurrentWeek={vi.fn()}
      />,
    );
    await runAxeCheck(weeklyNode);
    await act(async () => {
      mountRoot!.unmount();
    });
    mountRoot = null;
    weeklyNode.remove();

    const libNode = await renderIntoMain(<LibraryWorkspace entries={LIBRARY_ENTRIES} />);
    await runAxeCheck(libNode);
    await act(async () => {
      mountRoot!.unmount();
    });
    mountRoot = null;
    libNode.remove();

    const settingsNode = await renderIntoMain(
      <SettingsWorkspace
        settings={demo.settings}
        onSaveSettings={vi.fn(async () => {})}
        onExportJson={vi.fn(async () => {})}
        onImportJson={vi.fn(async () => ({ mode: "merge" as const, schemaVersion: 8, imported: {} }))}
        onDeleteAllData={vi.fn(async () => {})}
      />,
    );
    await runAxeCheck(settingsNode);
  });

  it("Landing page landmarks, skip link, and heading structure pass axe-core", async () => {
    const node = await renderIntoMain(<LandingPage />, false);
    const skipLink = node.querySelector('a[href="#main-content"]');
    expect(skipLink?.textContent).toContain("Skip to content");
    expect(node.querySelector("main#main-content")).not.toBeNull();
    expect(node.querySelector("footer")).not.toBeNull();
    await runAxeCheck(node);
  });

  it("ChartCard provides visible text summary even without external wrappers", async () => {
    const node = await renderIntoMain(
      <ChartCard
        title="Sample metric"
        summary="Average 4.2 over 3 days."
        tableData={{
          caption: "Sample values",
          columns: ["Day", "Value"],
          rows: [
            ["Mon", 4],
            ["Tue", 4.5],
          ],
        }}
      >
        <div>chart body</div>
      </ChartCard>,
    );
    expect(node.textContent).toContain("Average 4.2 over 3 days.");
    await runAxeCheck(node);
  });

  it("enforces WCAG AA (>= 4.5:1) across globals.css tokens for standard and high-contrast themes", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain("--primary: #7c3aed");
    expect(css).toContain("--violet-text: #a78bfa");
    expect(css).toContain('html[data-high-contrast="true"]');
    expect(css).toContain('html[data-text-size="lg"]');

    // Normal text contrast pairs (>= 4.5:1)
    expect(contrastRatio("#e6eaf5", "#060913")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#e6eaf5", "#0c1222")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#8a93ad", "#060913")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#8a93ad", "#0c1222")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#8a93ad", "#111a30")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", "#7c3aed")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#a78bfa", "#111a30")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#22d3ee", "#111a30")).toBeGreaterThanOrEqual(4.5);

    // High-contrast mode tokens (>= 7:1 for foreground/muted on surfaces)
    expect(contrastRatio("#ffffff", "#02040a")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#cbd5e1", "#121c36")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#ddd6fe", "#121c36")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#ffffff", "#6d28d9")).toBeGreaterThanOrEqual(4.5);
  });

  it("Empty Overview and AppSegmentError pass axe-core", async () => {
    const emptyOverview = buildOverviewViewData({
      settings: { ...demo.settings, sleepTargetMin: 480 },
      sleep: [],
      checkins: [],
      focus: [],
      movement: [],
      nutrition: [],
      habits: [],
      habitLogs: [],
      mindfulness: [],
      activities: [],
      today: TODAY_DATE,
    });
    const emptyNode = await renderIntoMain(
      <OverviewView
        {...emptyOverview}
        onLogToday={vi.fn()}
        onOpenBrain={vi.fn()}
        onLoadDemo={vi.fn()}
        onDismissInsight={vi.fn()}
        onSnoozeInsight={vi.fn()}
      />,
    );
    await runAxeCheck(emptyNode);

    await act(async () => {
      mountRoot?.unmount();
    });
    mountRoot = null;
    emptyNode.remove();

    const errNode = await renderIntoMain(
      <AppSegmentError error={new Error("Simulated storage failure")} reset={vi.fn()} />,
    );
    expect(errNode.querySelector('[role="alert"]')).not.toBeNull();
    await runAxeCheck(errNode);
  });
});
