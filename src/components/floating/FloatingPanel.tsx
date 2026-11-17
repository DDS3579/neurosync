"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { cn } from "@/lib/utils";
import { useFloatingPanelLayer } from "./FloatingPanelLayer";
import {
  PANEL_KEYBOARD_STEP,
  PANEL_VIEWPORT_MARGIN,
  clampPanelPosition,
  snapPanelPosition,
  type PanelPosition,
  type PanelSize,
} from "./panelLayout";
import { usePanelLayout } from "./usePanelLayout";

export interface FloatingPanelProps {
  id: string;
  title: string;
  icon?: ReactNode;
  defaultPosition: PanelPosition;
  resolveDefaultPosition?: (
    viewport: { width: number; height: number },
    size: { width: number; height: number },
  ) => PanelPosition;
  defaultSize?: PanelSize;
  defaultCollapsed?: boolean | ((viewport: { width: number; height: number }) => boolean);
  collapsedContent?: ReactNode;
  collapsible?: boolean;
  resizable?: boolean;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}

const DEFAULT_PANEL_WIDTH = 300;
const MIN_RESIZE_WIDTH = 240;
const MIN_RESIZE_HEIGHT = 140;

/**
 * Non-modal floating glass panel (`role="region"`) for desktop immersive layouts,
 * collapsing to a compact draggable chip and adapting to a bottom sheet stack on mobile.
 */
export function FloatingPanel({
  id,
  title,
  icon,
  defaultPosition,
  resolveDefaultPosition,
  defaultSize,
  defaultCollapsed = false,
  collapsedContent,
  collapsible = true,
  resizable = false,
  onClose,
  className,
  children,
}: FloatingPanelProps) {
  const {
    isMobile,
    mobileSlotEl,
    activeMobilePanelId,
    registerMobilePanel,
    unregisterMobilePanel,
    returnFocusToCanvas,
  } = useFloatingPanelLayer();
  const reducedMotion = usePrefersReducedMotion();

  const panel = usePanelLayout((s) => s.panels[id]);
  const registerPanel = usePanelLayout((s) => s.registerPanel);
  const setMeasuredSize = usePanelLayout((s) => s.setMeasuredSize);
  const setPosition = usePanelLayout((s) => s.setPosition);
  const setSize = usePanelLayout((s) => s.setSize);
  const toggleCollapsed = usePanelLayout((s) => s.toggleCollapsed);
  const bringToFront = usePanelLayout((s) => s.bringToFront);

  const panelRef = useRef<HTMLElement>(null);
  const [isSnapping, setIsSnapping] = useState(false);

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    rafId: number | null;
  } | null>(null);

  const resizeStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originW: number;
    originH: number;
  } | null>(null);

  const suppressClickRef = useRef(false);
  const snapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const viewport =
      typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : undefined;
    registerPanel(
      { id, defaultPosition, resolveDefaultPosition, defaultSize, defaultCollapsed },
      viewport,
    );
    // Intentionally register on mount or id change; caller defaults may be inline objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, registerPanel]);

  useEffect(() => {
    registerMobilePanel({ id, title, icon, closed: panel?.closed });
    return () => unregisterMobilePanel(id);
  }, [id, title, icon, panel?.closed, registerMobilePanel, unregisterMobilePanel]);

  // Measure rendered panel bounds so collapsing/expanding or content growth stays clamped.
  useEffect(() => {
    if (isMobile) return;
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      if (dragStateRef.current?.active) return;
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      setMeasuredSize(id, {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, isMobile, setMeasuredSize]);

  useEffect(() => {
    return () => {
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
      if (dragStateRef.current?.rafId !== null && dragStateRef.current?.rafId !== undefined) {
        window.cancelAnimationFrame(dragStateRef.current.rafId);
      }
    };
  }, []);

  if (panel?.closed) return null;

  if (isMobile) {
    if (activeMobilePanelId === id && mobileSlotEl) {
      return createPortal(<>{children}</>, mobileSlotEl);
    }
    return null;
  }

  const pos: PanelPosition = panel ? { x: panel.x, y: panel.y } : defaultPosition;
  const collapsed = panel
    ? Boolean(panel.collapsed)
    : typeof defaultCollapsed === "boolean"
      ? defaultCollapsed
      : false;
  const width = panel?.width ?? defaultSize?.width ?? DEFAULT_PANEL_WIDTH;
  const height = panel?.height ?? defaultSize?.height;
  const zIndex = panel?.zIndex ?? 1;

  const getViewport = () =>
    typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1440, height: 900 };

  const getPanelDimensions = () => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
    return {
      width: collapsed ? 180 : width,
      height: collapsed ? 36 : (height ?? 240),
    };
  };

  const handleHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as Element | null;
    if (target?.closest('[data-panel-action="true"]')) return;

    bringToFront(id);

    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      lastX: pos.x,
      lastY: pos.y,
      moved: false,
      rafId: null,
    };
  };

  const handleHeaderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || !drag.active || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 4) {
      drag.moved = true;
      // Capture only once a drag actually starts so plain clicks reach the inner toggle button.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer events without active pointer capture.
      }
    }
    if (!drag.moved) return;

    const clamped = clampPanelPosition(
      { x: drag.originX + dx, y: drag.originY + dy },
      getPanelDimensions(),
      getViewport(),
    );
    drag.lastX = clamped.x;
    drag.lastY = clamped.y;

    if (drag.rafId === null) {
      drag.rafId = window.requestAnimationFrame(() => {
        if (dragStateRef.current) {
          dragStateRef.current.rafId = null;
        }
        if (panelRef.current) {
          panelRef.current.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
        }
      });
    }
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.rafId !== null) {
      window.cancelAnimationFrame(drag.rafId);
    }
    dragStateRef.current = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic pointer events.
    }

    if (!drag.moved) return;

    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const snapped = snapPanelPosition(
      { x: drag.originX + dx, y: drag.originY + dy },
      getPanelDimensions(),
      getViewport(),
    );

    if (snapped.snapped && !reducedMotion) {
      setIsSnapping(true);
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
      snapTimerRef.current = window.setTimeout(() => setIsSnapping(false), 160);
    }

    if (panelRef.current) {
      panelRef.current.style.transform = `translate3d(${snapped.x}px, ${snapped.y}px, 0)`;
    }
    setPosition(id, { x: snapped.x, y: snapped.y });
  };

  const handleToggleCollapse = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!collapsible) return;
    bringToFront(id);
    toggleCollapsed(id, getViewport());
  };

  const handlePanelKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
      returnFocusToCanvas();
      return;
    }

    if (!e.altKey) return;

    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -PANEL_KEYBOARD_STEP;
    else if (e.key === "ArrowRight") dx = PANEL_KEYBOARD_STEP;
    else if (e.key === "ArrowUp") dy = -PANEL_KEYBOARD_STEP;
    else if (e.key === "ArrowDown") dy = PANEL_KEYBOARD_STEP;
    else return;

    e.preventDefault();
    e.stopPropagation();
    const next = clampPanelPosition(
      { x: pos.x + dx, y: pos.y + dy },
      getPanelDimensions(),
      getViewport(),
    );
    setPosition(id, next);
  };

  const handleResizePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizable || collapsed || e.button !== 0) return;
    e.stopPropagation();
    bringToFront(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events.
    }
    const dims = getPanelDimensions();
    resizeStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originW: dims.width,
      originH: dims.height,
    };
  };

  const handleResizePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeStateRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    const viewport = getViewport();
    const maxW = Math.max(MIN_RESIZE_WIDTH, viewport.width - pos.x - PANEL_VIEWPORT_MARGIN);
    const maxH = Math.max(MIN_RESIZE_HEIGHT, viewport.height - pos.y - PANEL_VIEWPORT_MARGIN);
    const nextW = Math.min(maxW, Math.max(MIN_RESIZE_WIDTH, r.originW + (e.clientX - r.startX)));
    const nextH = Math.min(maxH, Math.max(MIN_RESIZE_HEIGHT, r.originH + (e.clientY - r.startY)));
    if (panelRef.current) {
      panelRef.current.style.width = `${Math.round(nextW)}px`;
      panelRef.current.style.height = `${Math.round(nextH)}px`;
    }
  };

  const handleResizePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeStateRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    resizeStateRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic events.
    }
    const viewport = getViewport();
    const maxW = Math.max(MIN_RESIZE_WIDTH, viewport.width - pos.x - PANEL_VIEWPORT_MARGIN);
    const maxH = Math.max(MIN_RESIZE_HEIGHT, viewport.height - pos.y - PANEL_VIEWPORT_MARGIN);
    const nextW = Math.min(maxW, Math.max(MIN_RESIZE_WIDTH, r.originW + (e.clientX - r.startX)));
    const nextH = Math.min(maxH, Math.max(MIN_RESIZE_HEIGHT, r.originH + (e.clientY - r.startY)));
    setSize(id, { width: nextW, height: nextH });
  };

  return (
    <section
      ref={panelRef}
      role="region"
      aria-label={title}
      data-brain-panel="true"
      data-panel-id={id}
      data-collapsed={collapsed ? "true" : "false"}
      onPointerDown={() => bringToFront(id)}
      onFocusCapture={() => bringToFront(id)}
      onKeyDown={handlePanelKeyDown}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        zIndex,
        width: collapsed ? "auto" : `${width}px`,
        maxWidth: `calc(100vw - ${PANEL_VIEWPORT_MARGIN * 2}px)`,
        ...(height !== undefined && !collapsed ? { height: `${height}px` } : {}),
        maxHeight: `calc(100dvh - ${PANEL_VIEWPORT_MARGIN * 2}px)`,
      }}
      className={cn(
        "pointer-events-auto fixed top-0 left-0 flex flex-col overflow-hidden border border-border bg-surface/80 text-foreground shadow-xl backdrop-blur-md",
        collapsed ? "rounded-full" : "rounded-[14px]",
        isSnapping && !reducedMotion && "transition-transform duration-150 ease-out",
        className,
      )}
    >
      <div
        data-panel-header="true"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className={cn(
          "flex shrink-0 touch-none items-center gap-1.5 select-none",
          collapsed
            ? "cursor-grab px-3 py-1.5 active:cursor-grabbing"
            : "cursor-grab border-b border-border px-3 py-2 active:cursor-grabbing",
        )}
      >
        <button
          type="button"
          aria-expanded={collapsible ? !collapsed : undefined}
          aria-label={
            collapsible
              ? `${title}. ${collapsed ? "Expand" : "Collapse"} panel. Alt+Arrow keys to move.`
              : `${title}. Alt+Arrow keys to move.`
          }
          onClick={handleToggleCollapse}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed
              ? "text-caption text-muted-foreground hover:text-foreground"
              : "text-caption font-medium text-foreground",
          )}
        >
          {icon ? (
            <span className="shrink-0 text-cyan" aria-hidden>
              {icon}
            </span>
          ) : null}
          {!(collapsed && collapsedContent) ? (
            <span className="truncate">{title}</span>
          ) : null}
          {collapsible ? (
            collapsed ? (
              <ChevronDown className="ml-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronUp className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )
          ) : null}
        </button>

        {collapsed && collapsedContent ? (
          <div className="flex items-center gap-1">{collapsedContent}</div>
        ) : null}

        {onClose && !collapsed ? (
          <button
            type="button"
            data-panel-action="true"
            aria-label={`Close ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5">
          {children}
        </div>
      ) : null}

      {resizable && !collapsed ? (
        <div
          data-panel-action="true"
          aria-hidden="true"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          className="absolute right-0.5 bottom-0.5 size-3.5 cursor-nwse-resize touch-none opacity-45 hover:opacity-90"
        >
          <svg viewBox="0 0 12 12" className="size-full text-muted-foreground">
            <path
              d="M11 5L5 11M11 9L9 11"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
        </div>
      ) : null}
    </section>
  );
}
