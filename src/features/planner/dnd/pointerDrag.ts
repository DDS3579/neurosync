/**
 * A tiny, dependency-free pointer drag controller used only by the planner's
 * drop rail. It is loaded through a dynamic import from PlannerTodayPanel, so
 * this code stays in its own chunk and never touches other routes.
 *
 * Rendering rule: pointermove handlers only record coordinates. The floating
 * ghost is positioned inside requestAnimationFrame by writing a transform
 * directly, so dragging never triggers a React render (no re-render per frame).
 */

const GHOST_ID = "planner-drag-ghost";
const DRAG_THRESHOLD_PX = 6;

export interface BeginBlockDragParams {
  blockId: string;
  title: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  onStart?: () => void;
  onHover?: (clock: string | null) => void;
  onDrop: (blockId: string, clock: string) => void;
  onCancel: () => void;
}

function slotClockAt(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y);
  const slot = element?.closest?.("[data-slot-clock]") as HTMLElement | null;
  const clock = slot?.dataset.slotClock;
  return clock && /^\d{2}:\d{2}$/.test(clock) ? clock : null;
}

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.getAttribute("data-reduced-motion") === "true" ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

export function beginBlockPointerDrag(params: BeginBlockDragParams): void {
  if (typeof window === "undefined") return;

  let ghost: HTMLDivElement | null = null;
  let frame = 0;
  let lastX = params.clientX;
  let lastY = params.clientY;
  let moved = false;
  let done = false;
  const reduced = prefersReducedMotion();

  const ensureGhost = () => {
    if (ghost) return;
    const node = document.createElement("div");
    node.id = GHOST_ID;
    node.setAttribute("aria-hidden", "true");
    node.textContent = params.title;
    node.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "z-index:2147483647",
      "pointer-events:none",
      "max-width:16rem",
      "padding:0.375rem 0.625rem",
      "border-radius:8px",
      "border:1px solid rgba(34,211,238,0.55)",
      "background:#0C1222",
      "color:#E6EAF5",
      "font-size:12px",
      "line-height:1.2",
      "box-shadow:0 8px 24px rgba(0,0,0,0.45)",
      reduced ? "" : "transition:opacity 120ms ease",
    ].join(";");
    document.body.appendChild(node);
    ghost = node;
  };

  const paint = () => {
    if (!ghost) return;
    ghost.style.transform = `translate3d(${Math.round(lastX + 14)}px, ${Math.round(lastY + 12)}px, 0)`;
    frame = window.requestAnimationFrame(paint);
  };

  const cleanup = () => {
    if (done) return;
    done = true;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    ghost?.remove();
    ghost = null;
    document.body.style.userSelect = "";
  };

  function onMove(event: PointerEvent) {
    if (event.pointerId !== params.pointerId) return;
    lastX = event.clientX;
    lastY = event.clientY;
    if (!moved) {
      const distance = Math.hypot(event.clientX - params.clientX, event.clientY - params.clientY);
      if (distance < DRAG_THRESHOLD_PX) return;
      moved = true;
      ensureGhost();
      params.onStart?.();
      document.body.style.userSelect = "none";
      if (!reduced) frame = window.requestAnimationFrame(paint);
    }
    params.onHover?.(slotClockAt(event.clientX, event.clientY));
  }

  function onUp(event: PointerEvent) {
    if (event.pointerId !== params.pointerId) return;
    const clock = moved ? slotClockAt(event.clientX, event.clientY) : null;
    cleanup();
    if (clock) params.onDrop(params.blockId, clock);
    else params.onCancel();
  }

  function onCancel() {
    cleanup();
    params.onCancel();
  }

  function onKey(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cleanup();
    params.onCancel();
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey);
}
