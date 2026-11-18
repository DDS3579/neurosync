// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { usePanelLayout } from "@/components/floating";
import { deriveBrainTimeline } from "@/features/brain/brainActivity";
import { BrainExplorerWorkspace } from "@/features/brain/components/BrainExplorerWorkspace";
import {
  BrainImpactPanel,
  IMPACT_DISCLAIMER,
} from "@/features/brain/components/BrainImpactPanel";
import { BrainQuickLogPanel } from "@/features/brain/components/BrainQuickLogPanel";
import { BrainTimeScrubber } from "@/features/brain/components/BrainTimeScrubber";
import { AppShell } from "@/components/app-shell/app-shell";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/brain",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function BrainExplorerStub(props: {
      selectedRegion: string | null;
      activity?: Record<string, number>;
    }) {
      return (
        <div
          data-testid="brain-explorer-stub"
          data-selected={props.selectedRegion ?? ""}
          data-has-activity={props.activity ? "true" : "false"}
        />
      );
    },
}));

const BANNED_COPY_PATTERNS = [
  /\baffected\b/i,
  /\bimproved\b/i,
  /\bstrengthened\b/i,
  /\bboosted\b/i,
  /\bbrain score\b/i,
  /\bscore\b/i,
  /\bdiagnos/i,
];

function assertNoBannedCopy(text: string) {
  for (const pattern of BANNED_COPY_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

describe("Brain Impact, Time Scrubber, and Quick Log components", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
    }
  });

  afterEach(async () => {
    vi.useRealTimers();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    if (root) {
      await act(async () => {
        root!.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    window.localStorage.clear();
    usePanelLayout.setState({
      hydrated: false,
      topZ: 1,
      panels: {},
      defaults: {},
      measuredSizes: {},
      activeMobilePanelId: null,
    });
  });

  async function renderNode(node: React.ReactNode): Promise<HTMLElement> {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<TooltipProvider>{node}</TooltipProvider>);
    });
    return container;
  }

  it("renders BrainImpactPanel overview rankings, region contributions, gated demo button, and honest copy", async () => {
    const onHighlightActivity = vi.fn();
    const onClearSelectedRegion = vi.fn();
    const onLoadDemo = vi.fn().mockResolvedValue(undefined);

    const items = [
      { kind: "exercise" as const, label: "Exercise", minutes: 30, count: 1 },
      { kind: "deep_focus" as const, label: "Deep focus", minutes: 90, count: 2 },
    ];

    // 1. Overview mode with ranked activities
    const host = await renderNode(
      <BrainImpactPanel
        selectedRegion={null}
        items={items}
        windowDays={7}
        windowStart="2026-11-10"
        windowEnd="2026-11-16"
        highlightedActivity={null}
        onHighlightActivity={onHighlightActivity}
        hasAnyData
        onLoadDemo={onLoadDemo}
      />,
    );

    expect(host.textContent).toContain(IMPACT_DISCLAIMER);
    assertNoBannedCopy(host.textContent ?? "");

    const activityButtons = Array.from(host.querySelectorAll("button[aria-pressed]"));
    expect(activityButtons).toHaveLength(2);
    expect(activityButtons[0]!.textContent).toContain("Deep focus");
    expect(activityButtons[0]!.textContent).toContain("90m");

    await act(async () => {
      (activityButtons[0] as HTMLButtonElement).click();
    });
    expect(onHighlightActivity).toHaveBeenCalledWith("deep_focus");

    // 2. Region mode shows share + 1-line explanation + honest framing
    await act(async () => {
      root!.render(
        <TooltipProvider>
          <BrainImpactPanel
            selectedRegion="parietal"
            items={items}
            windowDays={7}
            windowStart="2026-11-10"
            windowEnd="2026-11-16"
            highlightedActivity={null}
            onHighlightActivity={onHighlightActivity}
            onClearSelectedRegion={onClearSelectedRegion}
            hasAnyData
            onLoadDemo={onLoadDemo}
          />
        </TooltipProvider>,
      );
    });

    expect(host.textContent).toContain("78% share");
    expect(host.textContent).toContain("22% share");
    expect(host.textContent).toContain("commonly associated with");
    expect(host.textContent).toContain("based on what you logged");
    expect(host.textContent).toContain(IMPACT_DISCLAIMER);
    assertNoBannedCopy(host.textContent ?? "");

    // 3. Empty window with existing data elsewhere hides "Load demo data"
    await act(async () => {
      root!.render(
        <TooltipProvider>
          <BrainImpactPanel
            selectedRegion={null}
            items={[]}
            windowDays={7}
            windowStart="2026-11-10"
            windowEnd="2026-11-16"
            highlightedActivity={null}
            onHighlightActivity={onHighlightActivity}
            hasAnyData
            onLoadDemo={onLoadDemo}
          />
        </TooltipProvider>,
      );
    });
    expect(host.textContent).not.toContain("Load demo data");
    assertNoBannedCopy(host.textContent ?? "");

    // 4. Completely empty user state reveals "Load demo data"
    await act(async () => {
      root!.render(
        <TooltipProvider>
          <BrainImpactPanel
            selectedRegion={null}
            items={[]}
            windowDays={7}
            windowStart="2026-11-10"
            windowEnd="2026-11-16"
            highlightedActivity={null}
            onHighlightActivity={onHighlightActivity}
            hasAnyData={false}
            onLoadDemo={onLoadDemo}
          />
        </TooltipProvider>,
      );
    });
    const demoBtn = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Load demo data"),
    ) as HTMLButtonElement | undefined;
    expect(demoBtn).toBeDefined();
    await act(async () => {
      demoBtn!.click();
    });
    expect(onLoadDemo).toHaveBeenCalledTimes(1);
  });

  it("controls BrainTimeScrubber day stepping, accumulation mode, and disables playback in reduced motion", async () => {
    const timeline = deriveBrainTimeline({
      focus: [],
      movement: [],
      sleep: [],
      habits: [],
      habitLogs: [],
      activities: [
        {
          id: "a1",
          createdAt: "2026-11-15T10:00:00.000Z",
          updatedAt: "2026-11-15T10:00:00.000Z",
          date: "2026-11-15",
          type: "music",
          durationMin: 20,
          enjoyment: 4,
        },
      ],
      windowDays: 7,
      today: new Date("2026-11-16T12:00:00"),
    });

    const onChangeWindowDays = vi.fn();
    const onChangeCumulative = vi.fn();
    const onSelectDay = vi.fn();

    // Reduced motion disables Play button while keeping step controls functional
    const host = await renderNode(
      <BrainTimeScrubber
        timeline={timeline}
        windowDays={7}
        onChangeWindowDays={onChangeWindowDays}
        dayIndex={5}
        cumulative={false}
        onChangeCumulative={onChangeCumulative}
        onSelectDay={onSelectDay}
        reducedMotion
      />,
    );

    assertNoBannedCopy(host.textContent ?? "");
    const disabledPlay = host.querySelector(
      'button[aria-label="Playback disabled while reduced motion is enabled"]',
    ) as HTMLButtonElement;
    expect(disabledPlay).not.toBeNull();
    expect(disabledPlay.disabled).toBe(true);

    const prevBtn = host.querySelector('button[aria-label="Previous day"]') as HTMLButtonElement;
    const nextBtn = host.querySelector('button[aria-label="Next day"]') as HTMLButtonElement;
    await act(async () => {
      prevBtn.click();
    });
    expect(onSelectDay).toHaveBeenCalledWith(4);
    await act(async () => {
      nextBtn.click();
    });
    expect(onSelectDay).toHaveBeenCalledWith(6);

    // Non-reduced motion allows play/pause and advances days on interval
    vi.useFakeTimers();
    onSelectDay.mockClear();
    await act(async () => {
      root!.render(
        <TooltipProvider>
          <BrainTimeScrubber
            timeline={timeline}
            windowDays={7}
            onChangeWindowDays={onChangeWindowDays}
            dayIndex={1}
            cumulative
            onChangeCumulative={onChangeCumulative}
            onSelectDay={onSelectDay}
            reducedMotion={false}
          />
        </TooltipProvider>,
      );
    });

    const playBtn = host.querySelector('button[aria-label="Play through days"]') as HTMLButtonElement;
    expect(playBtn.disabled).toBe(false);
    // Never autoplays before clicking
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(onSelectDay).not.toHaveBeenCalled();

    await act(async () => {
      playBtn.click();
    });
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });

  it("submits quick activity, mood check-in, and focus shortcuts from BrainQuickLogPanel", async () => {
    const onCreateActivity = vi.fn().mockResolvedValue(undefined);
    const onQuickMoodCheckin = vi.fn().mockResolvedValue("created" as const);
    const onQuickFocusLog = vi.fn().mockResolvedValue(undefined);

    const host = await renderNode(
      <BrainQuickLogPanel
        onCreateActivity={onCreateActivity}
        onQuickMoodCheckin={onQuickMoodCheckin}
        onQuickFocusLog={onQuickFocusLog}
      />,
    );

    assertNoBannedCopy(host.textContent ?? "");

    // Preset 45m then submit activity form
    const preset45 = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "45m",
    ) as HTMLButtonElement;
    await act(async () => {
      preset45.click();
    });

    const form = host.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onCreateActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "social", durationMin: 45, enjoyment: 4 }),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("Logged 45m of social time.");

    // Select mood 5 and click Save
    const moodGroup = host.querySelector('[role="group"][aria-label="Mood rating 1 to 5"]')!;
    const mood5 = Array.from(moodGroup.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "5",
    ) as HTMLButtonElement;
    await act(async () => {
      mood5.click();
    });
    const saveMoodBtn = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Save",
    ) as HTMLButtonElement;
    await act(async () => {
      saveMoodBtn.click();
    });
    expect(onQuickMoodCheckin).toHaveBeenCalledWith(5, expect.any(String));

    // Focus topic + Start timer link + Log now
    const topicInput = host.querySelector(
      'input[aria-label="Focus session topic"]',
    ) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(topicInput, "Synapses");
      topicInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const startTimerLink = Array.from(host.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Start timer"),
    );
    expect(startTimerLink?.getAttribute("href")).toBe("/focus?subject=Synapses&plannedMin=25");

    const logNowBtn = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Log now",
    ) as HTMLButtonElement;
    await act(async () => {
      logNowBtn.click();
    });
    expect(onQuickFocusLog).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Synapses", durationMin: 25 }),
    );
  });

  it("mounts Impact, Time Scrubber, and collapsed-by-default Quick Log panels inside BrainExplorerWorkspace", async () => {
    const timeline7 = deriveBrainTimeline({
      focus: [],
      movement: [],
      sleep: [],
      habits: [],
      habitLogs: [],
      windowDays: 7,
      today: new Date("2026-11-16T12:00:00"),
    });
    const timeline30 = deriveBrainTimeline({
      focus: [],
      movement: [],
      sleep: [],
      habits: [],
      habitLogs: [],
      windowDays: 30,
      today: new Date("2026-11-16T12:00:00"),
    });

    const host = await renderNode(
      <AppShell>
        <BrainExplorerWorkspace
          activity={{}}
          loggedItems={[]}
          windowStart={timeline7.windowStart}
          windowEnd={timeline7.windowEnd}
          timeline7={timeline7}
          timeline30={timeline30}
          hasAnyData={false}
          onLoadDemo={vi.fn()}
          onCreateActivity={vi.fn()}
          onQuickMoodCheckin={vi.fn()}
          onQuickFocusLog={vi.fn()}
        />
      </AppShell>,
    );

    const impactPanel = host.querySelector('[data-panel-id="brain-impact-panel"]') as HTMLElement;
    const scrubberPanel = host.querySelector('[data-panel-id="brain-time-scrubber"]') as HTMLElement;
    const quickLogPanel = host.querySelector('[data-panel-id="brain-quick-log"]') as HTMLElement;

    expect(impactPanel).not.toBeNull();
    expect(scrubberPanel).not.toBeNull();
    expect(quickLogPanel).not.toBeNull();

    expect(impactPanel.getAttribute("data-collapsed")).toBe("false");
    expect(scrubberPanel.getAttribute("data-collapsed")).toBe("false");
    expect(quickLogPanel.getAttribute("data-collapsed")).toBe("true");
    expect(impactPanel.textContent).toContain("Load demo data");
  });
});
