"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { usePanelLayout } from "./usePanelLayout";

export interface MobilePanelMeta {
  id: string;
  title: string;
  icon?: ReactNode;
  closed?: boolean;
}

interface FloatingPanelLayerContextValue {
  isMobile: boolean;
  mobileSlotEl: HTMLElement | null;
  activeMobilePanelId: string | null;
  registerMobilePanel: (meta: MobilePanelMeta) => void;
  unregisterMobilePanel: (id: string) => void;
  returnFocusToCanvas: () => void;
}

const FloatingPanelLayerContext = createContext<FloatingPanelLayerContextValue>({
  isMobile: false,
  mobileSlotEl: null,
  activeMobilePanelId: null,
  registerMobilePanel: () => {},
  unregisterMobilePanel: () => {},
  returnFocusToCanvas: () => {},
});

export function useFloatingPanelLayer() {
  return useContext(FloatingPanelLayerContext);
}

export interface FloatingPanelLayerProps {
  children: ReactNode;
  className?: string;
  /** Optional custom callback when Esc inside a floating panel returns focus to the canvas. */
  onReturnFocusToCanvas?: () => void;
}

/**
 * Full-viewport overlay layer (`pointer-events: none`) hosting draggable floating
 * panels on desktop and a single-active bottom sheet + chip row on mobile (<768px).
 */
export function FloatingPanelLayer({
  children,
  className,
  onReturnFocusToCanvas,
}: FloatingPanelLayerProps) {
  const isMobile = useIsMobile();
  const hydrateFromStorage = usePanelLayout((s) => s.hydrateFromStorage);
  const clampAllToViewport = usePanelLayout((s) => s.clampAllToViewport);
  const activeMobilePanelId = usePanelLayout((s) => s.activeMobilePanelId);
  const setMobileActivePanel = usePanelLayout((s) => s.setMobileActivePanel);

  const [mobileSlotEl, setMobileSlotEl] = useState<HTMLDivElement | null>(null);
  const [mobilePanels, setMobilePanels] = useState<MobilePanelMeta[]>([]);

  useEffect(() => {
    hydrateFromStorage();
    if (typeof window !== "undefined") {
      clampAllToViewport({ width: window.innerWidth, height: window.innerHeight });
    }
  }, [hydrateFromStorage, clampAllToViewport]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      clampAllToViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [clampAllToViewport]);

  const registerMobilePanel = useCallback((meta: MobilePanelMeta) => {
    setMobilePanels((prev) => {
      const idx = prev.findIndex((p) => p.id === meta.id);
      if (idx === -1) return [...prev, meta];
      const existing = prev[idx];
      if (
        existing?.title === meta.title &&
        existing?.icon === meta.icon &&
        existing?.closed === meta.closed
      ) {
        return prev;
      }
      const next = [...prev];
      next[idx] = meta;
      return next;
    });
  }, []);

  const unregisterMobilePanel = useCallback((id: string) => {
    setMobilePanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const returnFocusToCanvas = useCallback(() => {
    if (onReturnFocusToCanvas) {
      onReturnFocusToCanvas();
      return;
    }
    if (typeof document === "undefined") return;
    const target =
      document.querySelector<HTMLElement>('[data-brain-canvas-focus="true"]') ??
      document.querySelector<HTMLElement>('[role="region"][aria-label="Interactive 3D brain atlas"]');
    target?.focus();
  }, [onReturnFocusToCanvas]);

  const visibleChips = useMemo(
    () => mobilePanels.filter((panel) => !panel.closed),
    [mobilePanels],
  );
  const activeMobileMeta = useMemo(
    () => visibleChips.find((panel) => panel.id === activeMobilePanelId) ?? null,
    [visibleChips, activeMobilePanelId],
  );

  const contextValue = useMemo<FloatingPanelLayerContextValue>(
    () => ({
      isMobile,
      mobileSlotEl,
      activeMobilePanelId,
      registerMobilePanel,
      unregisterMobilePanel,
      returnFocusToCanvas,
    }),
    [
      isMobile,
      mobileSlotEl,
      activeMobilePanelId,
      registerMobilePanel,
      unregisterMobilePanel,
      returnFocusToCanvas,
    ],
  );

  return (
    <FloatingPanelLayerContext.Provider value={contextValue}>
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-30 overflow-hidden",
          className,
        )}
      >
        {children}

        {isMobile && visibleChips.length > 0 ? (
          <div className="pointer-events-none fixed inset-x-3 bottom-3 z-30 flex flex-col gap-2">
            {activeMobileMeta ? (
              <section
                role="region"
                aria-label={activeMobileMeta.title}
                data-brain-panel="true"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setMobileActivePanel(null);
                    returnFocusToCanvas();
                  }
                }}
                className="pointer-events-auto flex max-h-[48dvh] flex-col overflow-hidden rounded-[14px] border border-border-strong bg-surface/85 text-foreground shadow-xl backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={() => setMobileActivePanel(null)}
                  aria-label={`Collapse ${activeMobileMeta.title}`}
                  className="flex shrink-0 flex-col items-center gap-1.5 border-b border-border px-3.5 pt-2 pb-2.5 text-left"
                >
                  <span
                    aria-hidden="true"
                    className="h-1 w-9 rounded-full bg-white/20"
                  />
                  <span className="flex w-full items-center justify-between gap-2 text-caption font-medium text-foreground">
                    <span className="flex min-w-0 items-center gap-2">
                      {activeMobileMeta.icon ? (
                        <span className="shrink-0 text-cyan" aria-hidden>
                          {activeMobileMeta.icon}
                        </span>
                      ) : null}
                      <span className="truncate">{activeMobileMeta.title}</span>
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  </span>
                </button>
                <div
                  ref={setMobileSlotEl}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5"
                />
              </section>
            ) : null}

            <div
              data-brain-panel="true"
              role="group"
              aria-label="Floating panels"
              className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5"
            >
              {visibleChips.map((chip) => {
                const isOpen = activeMobileMeta?.id === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={isOpen}
                    onClick={() => setMobileActivePanel(isOpen ? null : chip.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption backdrop-blur-md transition-colors motion-reduce:transition-none",
                      isOpen
                        ? "border-cyan/60 bg-surface/90 text-foreground"
                        : "border-border bg-surface/80 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {chip.icon ? (
                      <span className="shrink-0 text-cyan" aria-hidden>
                        {chip.icon}
                      </span>
                    ) : null}
                    <span>{chip.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </FloatingPanelLayerContext.Provider>
  );
}
