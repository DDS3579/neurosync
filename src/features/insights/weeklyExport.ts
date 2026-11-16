import { BRAIN_REGIONS } from "@/data/brainRegions";
import { ACTIVITY_DISCLAIMER } from "@/features/brain/BrainExplorer";
import { LEARNING_METHOD_OPTIONS } from "@/features/focus/timerUtils";
import type { WeeklyReport } from "@/lib/insights";
import type { LearningMethod, RegionId } from "@/types/domain";

export const WEEKLY_EXPORT_FOOTER =
  "Self-reported data from NeuroSync. Not a medical assessment.";

const REGION_NAMES: Record<RegionId, string> = Object.fromEntries(
  BRAIN_REGIONS.map((r) => [r.id, r.name]),
) as Record<RegionId, string>;

const METHOD_LABELS: Record<LearningMethod, string> = Object.fromEntries(
  LEARNING_METHOD_OPTIONS.map((m) => [m.value, m.label]),
) as Record<LearningMethod, string>;

export function formatMinutesLabel(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

export function formatDeltaBadge(
  entry: { delta: number; direction: "up" | "down" | "flat" } | undefined,
  unit: string,
  options?: { formatValue?: (absVal: number) => string },
): string | null {
  if (!entry) return null;
  if (entry.direction === "flat" || entry.delta === 0) {
    return "Similar to prev week";
  }
  const sign = entry.delta > 0 ? "+" : "−";
  const abs = Math.abs(entry.delta);
  const formatted = options?.formatValue ? options.formatValue(abs) : `${abs}${unit}`;
  return `${sign}${formatted} vs prev week`;
}

export function canSharePngFile(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders a crisp client-side PNG summary of the WeeklyReport using HTML5 Canvas
 * (no external DOM-to-image dependency, zero network calls).
 */
export async function renderWeeklyReportPngBlob(
  report: WeeklyReport,
  sleepTargetHours: number,
): Promise<Blob> {
  const width = 1200;
  const height = 1380;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas for export.");
  }

  const BG = "#060913";
  const SURFACE = "#0C1222";
  const SURFACE_2 = "#111A30";
  const BORDER = "rgba(255,255,255,0.10)";
  const TEXT = "#E6EAF5";
  const MUTED = "#8A93AD";
  const CYAN = "#22D3EE";
  const VIOLET = "#8B5CF6";
  const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = CYAN;
  ctx.font = `600 13px ${MONO}`;
  ctx.fillText("NEUROSYNC · YOUR WEEK", 56, 62);

  ctx.fillStyle = TEXT;
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText("Weekly Observatory Report", 56, 106);

  ctx.fillStyle = MUTED;
  ctx.font = `500 15px ${MONO}`;
  ctx.fillText(`${report.weekStart}  →  ${report.weekEnd}`, 56, 136);

  // Highlights & Prompts strip
  drawRoundedRect(ctx, 56, 162, 532, 232, 14);
  ctx.fillStyle = SURFACE;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = TEXT;
  ctx.font = `600 17px ${SANS}`;
  ctx.fillText("Highlights", 80, 198);

  ctx.font = `400 14px ${SANS}`;
  let y = 228;
  for (const h of report.highlights.slice(0, 3)) {
    ctx.fillStyle = CYAN;
    ctx.fillText("·", 80, y);
    ctx.fillStyle = MUTED;
    for (const line of wrapLines(ctx, h, 466).slice(0, 2)) {
      ctx.fillText(line, 96, y);
      y += 20;
    }
    y += 6;
  }

  drawRoundedRect(ctx, 612, 162, 532, 232, 14);
  ctx.fillStyle = SURFACE;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.stroke();

  ctx.fillStyle = TEXT;
  ctx.font = `600 17px ${SANS}`;
  ctx.fillText("Reflection prompts", 636, 198);

  ctx.font = `400 14px ${SANS}`;
  y = 228;
  for (const p of report.reflectionPrompts.slice(0, 3)) {
    ctx.fillStyle = VIOLET;
    ctx.fillText("?", 636, y);
    ctx.fillStyle = MUTED;
    for (const line of wrapLines(ctx, p, 466).slice(0, 2)) {
      ctx.fillText(line, 654, y);
      y += 20;
    }
    y += 6;
  }

  // Six pillar cards (2 columns x 3 rows)
  const cards: Array<{
    title: string;
    metric: string;
    detail: string;
    delta: string | null;
    bars: number[];
    accent: string;
  }> = [
    {
      title: "Sleep",
      metric:
        report.sleep.avgMin !== null ? formatMinutesLabel(report.sleep.avgMin) : "Not logged",
      detail:
        report.sleep.nightsLogged > 0
          ? `${report.sleep.nightsLogged} nights · target ${sleepTargetHours.toFixed(1)}h · spread ${report.sleep.bedtimeSpreadMin !== null ? `±${Math.round(report.sleep.bedtimeSpreadMin)}m` : "—"}`
          : "No sleep nights logged this week",
      delta: formatDeltaBadge(report.vsPreviousWeek.sleepAvgMin, "m", {
        formatValue: formatMinutesLabel,
      }),
      bars: report.daily.map((d) => d.sleepHours ?? 0),
      accent: CYAN,
    },
    {
      title: "Focus",
      metric:
        report.focus.sessions > 0 ? formatMinutesLabel(report.focus.totalMin) : "Not logged",
      detail:
        report.focus.sessions > 0
          ? `${report.focus.sessions} sessions · avg focus ${report.focus.avgFocusRating ?? "—"}/5`
          : "No focus sessions logged this week",
      delta: formatDeltaBadge(report.vsPreviousWeek.focusTotalMin, "m", {
        formatValue: formatMinutesLabel,
      }),
      bars: report.daily.map((d) => d.focusMin),
      accent: VIOLET,
    },
    {
      title: "Learning methods",
      metric:
        report.focus.methodsUsed.length > 0
          ? `${report.focus.methodsUsed.length} methods`
          : "Not logged",
      detail:
        report.focus.methodBreakdown.length > 0
          ? report.focus.methodBreakdown
              .slice(0, 3)
              .map((m) => `${METHOD_LABELS[m.method]} (${m.sessions})`)
              .join(" · ")
          : "Log Focus Lab sessions to see method mix",
      delta: `${report.focus.retrievalSessions} retrieval · ${report.focus.reviewedPriorSessions} review`,
      bars: report.focus.methodBreakdown.map((m) => m.totalMin),
      accent: CYAN,
    },
    {
      title: "Movement",
      metric:
        report.movement.daysActive > 0
          ? `${report.movement.daysActive} active days`
          : "Not logged",
      detail:
        report.movement.daysActive > 0
          ? `${formatMinutesLabel(report.movement.totalMin)} total logged movement`
          : "No movement logged this week",
      delta: formatDeltaBadge(report.vsPreviousWeek.movementTotalMin, "m", {
        formatValue: formatMinutesLabel,
      }),
      bars: report.daily.map((d) => d.movementMin),
      accent: "#34D399",
    },
    {
      title: "Wellbeing & nutrition",
      metric:
        report.wellbeing.checkins > 0
          ? `Mood ${report.wellbeing.avgMood ?? "—"}/5`
          : "Not logged",
      detail:
        report.wellbeing.checkins > 0
          ? `${report.wellbeing.checkins} check-ins · energy ${report.wellbeing.avgEnergy ?? "—"} · focus ${report.wellbeing.avgConcentration ?? "—"}`
          : "No check-ins logged this week",
      delta: formatDeltaBadge(report.vsPreviousWeek.avgMood, "/5"),
      bars: report.daily.map((d) => d.mood ?? 0),
      accent: VIOLET,
    },
    {
      title: "Activities & mind",
      metric:
        report.mind.mindfulnessSessions + report.activities.totalLogs > 0
          ? formatMinutesLabel(report.mind.mindfulnessMin + report.activities.totalMin)
          : "Not logged",
      detail: `${report.mind.mindfulnessSessions} mindfulness · ${report.activities.totalLogs} activities (${report.activities.distinctTypes} kinds) · ${report.mind.journalEntries} journal`,
      delta: formatDeltaBadge(report.vsPreviousWeek.activitiesMin, "m", {
        formatValue: formatMinutesLabel,
      }),
      bars: report.daily.map((d) => d.mindAndActivityMin),
      accent: CYAN,
    },
  ];

  cards.forEach((card, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 56 + col * 556;
    const cy = 418 + row * 212;
    const cw = 532;
    const ch = 192;

    drawRoundedRect(ctx, x, cy, cw, ch, 14);
    ctx.fillStyle = SURFACE;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = `500 13px ${MONO}`;
    ctx.fillText(card.title.toUpperCase(), x + 24, cy + 34);

    ctx.fillStyle = TEXT;
    ctx.font = `600 28px ${SANS}`;
    ctx.fillText(card.metric, x + 24, cy + 74);

    if (card.delta) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 12px ${MONO}`;
      ctx.fillText(card.delta, x + 24, cy + 100);
    }

    ctx.fillStyle = MUTED;
    ctx.font = `400 13px ${SANS}`;
    const detailLine = wrapLines(ctx, card.detail, 330)[0] ?? card.detail;
    ctx.fillText(detailLine, x + 24, cy + 158);

    // Mini spark bar chart on right side of card
    const barMax = Math.max(1, ...card.bars);
    const chartX = x + 372;
    const chartY = cy + 122;
    const barW = 14;
    const gap = 5;
    const maxH = 74;

    card.bars.slice(0, 7).forEach((val, bIdx) => {
      const bx = chartX + bIdx * (barW + gap);
      drawRoundedRect(ctx, bx, chartY - maxH, barW, maxH, 3);
      ctx.fillStyle = SURFACE_2;
      ctx.fill();
      if (val > 0) {
        const bh = Math.max(6, Math.round((val / barMax) * maxH));
        drawRoundedRect(ctx, bx, chartY - bh, barW, bh, 3);
        ctx.fillStyle = card.accent;
        ctx.fill();
      }
    });
  });

  // Brain activity summary strip
  drawRoundedRect(ctx, 56, 1062, 1088, 198, 14);
  ctx.fillStyle = SURFACE;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.stroke();

  ctx.fillStyle = TEXT;
  ctx.font = `600 17px ${SANS}`;
  ctx.fillText("Brain-region associations this week", 80, 1098);

  ctx.fillStyle = MUTED;
  ctx.font = `400 13px ${SANS}`;
  ctx.fillText(ACTIVITY_DISCLAIMER, 80, 1122);

  if (report.brainActivity.topRegions.length === 0) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 14px ${SANS}`;
    ctx.fillText("No focus, movement, mindfulness, activity, or sleep logs recorded this week.", 80, 1170);
  } else {
    const regions = report.brainActivity.topRegions.slice(0, 4);
    regions.forEach((r, idx) => {
      const rx = 80 + idx * 260;
      const ry = 1152;
      drawRoundedRect(ctx, rx, ry, 244, 72, 10);
      ctx.fillStyle = SURFACE_2;
      ctx.fill();
      ctx.strokeStyle = BORDER;
      ctx.stroke();

      ctx.fillStyle = TEXT;
      ctx.font = `500 14px ${SANS}`;
      ctx.fillText(REGION_NAMES[r.region], rx + 14, ry + 28);

      drawRoundedRect(ctx, rx + 14, ry + 44, 216, 8, 4);
      ctx.fillStyle = BG;
      ctx.fill();

      drawRoundedRect(
        ctx,
        rx + 14,
        ry + 44,
        Math.max(10, Math.round(216 * Math.min(1, r.intensity))),
        8,
        4,
      );
      ctx.fillStyle = CYAN;
      ctx.fill();
    });
  }

  // Required honest footer
  ctx.strokeStyle = BORDER;
  ctx.beginPath();
  ctx.moveTo(56, 1296);
  ctx.lineTo(1144, 1296);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = `500 14px ${MONO}`;
  ctx.fillText(WEEKLY_EXPORT_FOOTER, 56, 1332);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas PNG encoding returned an empty blob."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function downloadWeeklyReportPng(
  report: WeeklyReport,
  sleepTargetHours: number,
): Promise<void> {
  const blob = await renderWeeklyReportPngBlob(report, sleepTargetHours);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `neurosync-week-${report.weekStart}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function shareWeeklyReportPng(
  report: WeeklyReport,
  sleepTargetHours: number,
): Promise<"shared" | "unsupported"> {
  if (!canSharePngFile()) return "unsupported";
  const blob = await renderWeeklyReportPngBlob(report, sleepTargetHours);
  const file = new File([blob], `neurosync-week-${report.weekStart}.png`, {
    type: "image/png",
  });
  await navigator.share({
    files: [file],
    title: `NeuroSync — Week of ${report.weekStart}`,
    text: WEEKLY_EXPORT_FOOTER,
  });
  return "shared";
}
