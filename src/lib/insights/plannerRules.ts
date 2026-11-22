import { format, parseISO, subDays } from 'date-fns';
import { capacity } from '@/features/planner/blocks';
import {
  dayConstraintsFor,
  formatMinutes,
  plannedMinutes,
} from '@/features/planner/dayContext';
import {
  MIN_ESTIMATION_SAMPLES,
  buildPlannedActualReport,
  collectBlockSamples,
  pickEstimationPattern,
} from '@/features/planner/review/plannedVsActual';
import { timeToOffset } from '@/features/planner/plannerEngine';
import { parseHHMM } from '@/features/reminders/reminderUtils';
import type { Block, ISODate, InsightInput, Task } from '@/types/domain';
import { buildConfidence } from './confidence';
import { clamp } from './stats';
import type { InsightRule } from './rules';

const ESTIMATION_WINDOW_DAYS = 30;
const LOAD_WINDOW_PLANNED_DAYS = 7;
const SHALLOW_MIN_BLOCKS = 3;
const SHALLOW_MIN_DAYS = 2;
const SHUTDOWN_MIN_DAYS = 3;

const isoBefore = (today: ISODate, daysBack: number): ISODate =>
  format(subDays(parseISO(today), daysBack), 'yyyy-MM-dd');

const dayLabel = (date: ISODate): string => format(parseISO(date), 'MMM d');

function windowBlocks(blocks: readonly Block[], today: ISODate, days: number): Block[] {
  const start = isoBefore(today, days - 1);
  return blocks.filter(
    (block) => block.plannedDate && block.plannedDate >= start && block.plannedDate <= today,
  );
}

/** The most recent distinct dates that actually have blocks planned. */
function recentPlannedDates(blocks: readonly Block[], today: ISODate, limit: number): ISODate[] {
  const dates = new Set<ISODate>();
  for (const block of blocks) {
    if (block.plannedDate && block.plannedDate <= today) dates.add(block.plannedDate);
  }
  return [...dates].sort().reverse().slice(0, limit);
}

interface DayLoad {
  date: ISODate;
  availableMin: number;
  plannedMin: number;
  overByMin: number;
  shallowRuns: number;
  scheduledShallow: number;
}

function analyseDay(input: InsightInput, date: ISODate, tasks: readonly Task[]): DayLoad {
  const plan = (input.dayPlans ?? []).find((entry) => entry.date === date);
  const constraints = dayConstraintsFor(date, plan, {
    sleepTargetMin: input.settings.sleepTargetMin,
    deepWorkCapMin: input.settings.deepWorkCapMin,
    snapMin: input.settings.snapMin,
  });
  const kindByTaskId = new Map(tasks.map((task) => [task.id, task.kind]));
  const dayBlocks = (input.blocks ?? []).filter((block) => block.plannedDate === date);
  const summary = capacity({
    wakeTime: constraints.wakeTime,
    sleepTargetMin: constraints.sleepTargetMin,
    windDownMin: constraints.windDownMin,
    commitments: constraints.commitments ?? [],
    blocks: dayBlocks.map((block) => ({
      kind: kindByTaskId.get(block.taskId) ?? 'shallow',
      plannedMin: block.plannedMin,
      status: block.status,
    })),
    deepWorkCapMin: input.settings.deepWorkCapMin,
  });
  const planned = plannedMinutes(dayBlocks);

  const wakeMin = parseHHMM(constraints.wakeTime) ?? 420;
  const shallow = dayBlocks
    .filter(
      (block) =>
        block.status === 'scheduled' &&
        block.plannedStart &&
        (kindByTaskId.get(block.taskId) ?? 'shallow') === 'shallow',
    )
    .map((block) => {
      const start = timeToOffset(wakeMin, block.plannedStart!);
      return { start, end: start + Math.max(1, Math.round(block.plannedMin)) };
    })
    .sort((a, b) => a.start - b.start);
  let runs = shallow.length > 0 ? 1 : 0;
  for (let i = 1; i < shallow.length; i += 1) {
    if (shallow[i]!.start > shallow[i - 1]!.end) runs += 1;
  }

  return {
    date,
    availableMin: summary.availableMin,
    plannedMin: planned,
    overByMin: Math.max(0, planned - summary.availableMin),
    shallowRuns: runs,
    scheduledShallow: shallow.length,
  };
}

export const PLANNER_RULES: readonly InsightRule[] = [
  {
    id: 'block_estimation_pattern',
    pillar: 'focus',
    minSamples: MIN_ESTIMATION_SAMPLES,
    dedupeGroup: 'block_estimation',
    run(input, today) {
      const blocks = input.blocks ?? [];
      if (blocks.length === 0) return null;
      const samples = collectBlockSamples(
        windowBlocks(blocks, today, ESTIMATION_WINDOW_DAYS),
        input.tasks ?? [],
      );
      const report = buildPlannedActualReport(samples);
      const pattern = pickEstimationPattern(report);
      if (!pattern) return null;

      const longer = pattern.deltaMin > 0;
      const bucket = Math.round(pattern.avgPlannedMin);
      const gap = Math.abs(pattern.deltaMin);
      return {
        id: 'block_estimation_pattern',
        pillar: 'focus',
        kind: 'observation',
        title: `${bucket}m blocks have been running ${longer ? 'longer' : 'shorter'} than planned`,
        body: `Across ${pattern.n} completed ${bucket}m blocks in the last ${ESTIMATION_WINDOW_DAYS} days, you logged about ${formatMinutes(
          pattern.avgActualMin,
        )} on average against ${formatMinutes(pattern.avgPlannedMin)} planned — roughly ${formatMinutes(
          gap,
        )} ${longer ? 'longer' : 'shorter'}. Estimates are guesses that settle with practice; this is a description of your own logged durations, not a target to hit.`,
        evidence: [
          `${pattern.n} completed ${bucket}m blocks (last ${ESTIMATION_WINDOW_DAYS} days)`,
          `Average planned: ${formatMinutes(pattern.avgPlannedMin)}`,
          `Average logged: ${formatMinutes(pattern.avgActualMin)}`,
          `Difference: ${longer ? '+' : '−'}${formatMinutes(gap)}`,
        ],
        caveat: `Self-reported timer durations over ${pattern.n} blocks. Topic difficulty, interruptions and time of day all move these numbers, so this pattern does not explain why they differ.`,
        confidence: buildConfidence({
          sampleSize: pattern.n,
          unit: 'block',
          paired: true,
          effectStrength: clamp(
            gap / Math.max(1, pattern.avgPlannedMin),
            0,
            1,
          ),
        }),
      };
    },
  },
  {
    id: 'day_overpacking_pattern',
    pillar: 'wellbeing',
    minSamples: 3,
    dedupeGroup: 'day_load',
    run(input, today) {
      const blocks = input.blocks ?? [];
      if (blocks.length === 0) return null;
      const dates = recentPlannedDates(blocks, today, LOAD_WINDOW_PLANNED_DAYS);
      if (dates.length < 3) return null;
      const tasks = input.tasks ?? [];
      const loads = dates.map((date) => analyseDay(input, date, tasks));
      const over = loads.filter((load) => load.overByMin > 0);
      if (over.length < 3) return null;

      const biggest = over.reduce((max, load) => Math.max(max, load.overByMin), 0);
      const ordered = [...dates].sort();
      return {
        id: 'day_overpacking_pattern',
        pillar: 'wellbeing',
        kind: 'reflection',
        title: 'Several days were planned beyond your available time',
        body: `On ${over.length} of your last ${dates.length} planned days, the blocks you placed added up to more time than the day held between waking and wind-down. Full days happen, and nothing here is locked. If it feels useful, moving one block to another day or back to the tray is always an option.`,
        evidence: [
          `${over.length} of ${dates.length} planned days over available time`,
          `Biggest single-day gap: ${formatMinutes(biggest)}`,
          `Days considered: ${dayLabel(ordered[0]!)} – ${dayLabel(ordered[ordered.length - 1]!)}`,
        ],
        caveat:
          'Self-reported plans and sleep settings over a small window. Available time is an estimate from your wake time, sleep target and fixed commitments, not a measurement of your day.',
        confidence: buildConfidence({ sampleSize: dates.length, unit: 'day' }),
      };
    },
  },
  {
    id: 'shallow_blocks_scattered',
    pillar: 'focus',
    minSamples: SHALLOW_MIN_BLOCKS,
    dedupeGroup: 'shallow_layout',
    run(input, today) {
      const blocks = input.blocks ?? [];
      if (blocks.length === 0) return null;
      const dates = recentPlannedDates(blocks, today, LOAD_WINDOW_PLANNED_DAYS);
      if (dates.length < SHALLOW_MIN_DAYS) return null;
      const tasks = input.tasks ?? [];
      const loads = dates.map((date) => analyseDay(input, date, tasks));
      const scattered = loads.filter(
        (load) => load.scheduledShallow >= SHALLOW_MIN_BLOCKS && load.shallowRuns >= 2,
      );
      if (scattered.length < SHALLOW_MIN_DAYS) return null;

      const totalShallow = scattered.reduce((sum, load) => sum + load.scheduledShallow, 0);
      const minRuns = scattered.reduce((min, load) => Math.min(min, load.shallowRuns), 99);
      const maxRuns = scattered.reduce((max, load) => Math.max(max, load.shallowRuns), 0);
      return {
        id: 'shallow_blocks_scattered',
        pillar: 'focus',
        kind: 'reflection',
        title: 'Shallow blocks are spread across the day',
        body: `On ${scattered.length} of your last ${dates.length} planned days you placed ${totalShallow} shallow blocks in ${minRuns}–${maxRuns} separate runs. Grouping them into one stretch leaves longer uninterrupted windows for deep work, if that suits your day.`,
        evidence: [
          `Days with scattered shallow blocks: ${scattered.length}`,
          `Shallow blocks on those days: ${totalShallow}`,
          `Separate runs per day: ${minRuns}–${maxRuns}`,
        ],
        caveat:
          'Self-reported block placements. Spread is a description of layout, not a judgement about how you work.',
        confidence: buildConfidence({ sampleSize: totalShallow, unit: 'block' }),
      };
    },
  },
  {
    id: 'shutdown_ritual_days',
    pillar: 'wellbeing',
    minSamples: SHUTDOWN_MIN_DAYS,
    dedupeGroup: 'day_close',
    run(input, today) {
      const meta = input.dayPlanMeta ?? [];
      if (meta.length === 0) return null;
      const start = isoBefore(today, 6);
      const closed = [...new Set(
        meta
          .filter((entry) => entry.shutdownDone && entry.date >= start && entry.date <= today)
          .map((entry) => entry.date),
      )].sort();
      if (closed.length < SHUTDOWN_MIN_DAYS) return null;
      return {
        id: 'shutdown_ritual_days',
        pillar: 'wellbeing',
        kind: 'milestone',
        title: 'You closed the day several times this week',
        body: `You marked the day as closed on ${closed.length} of the last 7 days. Naming an end point is a quiet way to let a day be finished, and the days you left open are equally fine.`,
        evidence: [
          `Days closed: ${closed.length} of the last 7`,
          `Dates: ${closed.map(dayLabel).join(', ')}`,
        ],
        caveat:
          'Self-reported shutdown checkmarks. This counts what you recorded, not how restful your evenings were.',
        confidence: buildConfidence({
          sampleSize: closed.length,
          unit: 'day',
          windowDays: 7,
        }),
      };
    },
  },
];
