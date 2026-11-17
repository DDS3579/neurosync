import { format, startOfDay, subDays } from "date-fns";

import { PERSONAL_ACTIVITY_LABELS } from "@/features/activities/activityUtils";
import type {
  ActivityLog,
  FocusSession,
  Habit,
  HabitLog,
  ISODate,
  LearningMethod,
  MindfulnessSession,
  MindfulnessType,
  MovementLog,
} from "@/types/domain";

export type ConstellationWindowDays = 14 | 30 | 90;

export const CONSTELLATION_WINDOW_OPTIONS: readonly ConstellationWindowDays[] = [14, 30, 90];
export const MIN_CONSTELLATION_DAYS = 10;
export const MIN_SHARED_DAYS = 3;

export const CONSTELLATION_CAVEAT =
  "Purely descriptive: lines show how often two entries happened on the same day, not whether one explains another.";

export const CONSTELLATION_VIEWBOX = {
  width: 800,
  height: 540,
  padding: 62,
} as const;

export type ConstellationCategory =
  | "habit"
  | "activity"
  | "method"
  | "movement"
  | "mindfulness";

export const CONSTELLATION_CATEGORY_LABELS: Record<ConstellationCategory, string> = {
  habit: "Habit",
  activity: "Activity",
  method: "Study method",
  movement: "Movement",
  mindfulness: "Mindfulness",
};

const LEARNING_METHOD_LABELS: Record<LearningMethod, string> = {
  active_recall: "Active recall",
  spaced_repetition: "Spaced repetition",
  problem_solving: "Problem solving",
  deep_reading: "Deep reading",
  skill_practice: "Skill practice",
  teaching: "Teaching",
};

const MOVEMENT_TYPE_LABELS: Record<MovementLog["type"], string> = {
  walk: "Walk",
  run: "Run",
  cycle: "Cycle",
  sport: "Sport",
  gym: "Gym",
  stretch: "Stretch",
  other: "Movement (other)",
};

const MINDFULNESS_TYPE_LABELS: Record<MindfulnessType, string> = {
  box_breathing: "Box breathing",
  "4_7_8_breathing": "4-7-8 breathing",
  meditation: "Meditation",
};

const CATEGORY_LOG_HREF: Record<ConstellationCategory, string> = {
  habit: "/habits#habits",
  activity: "/habits#activities",
  method: "/focus",
  movement: "/habits#movement",
  mindfulness: "/habits#mind",
};

export interface ConstellationNode {
  id: string;
  label: string;
  category: ConstellationCategory;
  daysPresent: number;
  dates: ISODate[];
  frequencyRatio: number;
  radius: number;
  brightness: number;
  x: number;
  y: number;
  logHref: string;
}

export interface ConstellationEdge {
  id: string;
  source: string;
  target: string;
  sharedDays: number;
  sharedDates: ISODate[];
  thickness: number;
}

export interface ConstellationNeighbor {
  nodeId: string;
  label: string;
  category: ConstellationCategory;
  sharedDays: number;
  description: string;
}

export interface ConstellationData {
  windowDays: ConstellationWindowDays;
  windowStart: ISODate;
  windowEnd: ISODate;
  datesInWindow: ISODate[];
  activeDaysCount: number;
  minDaysRequired: number;
  meetsMinDays: boolean;
  hasAnyData: boolean;
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  summaryText: string;
}

export interface ConstellationInput {
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  activities: readonly ActivityLog[];
  focus: readonly FocusSession[];
  movement: readonly MovementLog[];
  mindfulness: readonly MindfulnessSession[];
  windowDays?: ConstellationWindowDays;
  today?: Date;
}

function hashStringFNV1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatSameDayCount(sharedDays: number): string {
  return sharedDays === 1
    ? "happened on the same day 1 time"
    : `happened on the same day ${sharedDays} times`;
}

export function getCoOccurrencesForNode(
  nodeId: string,
  nodes: readonly ConstellationNode[],
  edges: readonly ConstellationEdge[],
  limit?: number,
): ConstellationNeighbor[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const items: ConstellationNeighbor[] = [];

  for (const edge of edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue;
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    const other = byId.get(otherId);
    if (!other) continue;
    items.push({
      nodeId: other.id,
      label: other.label,
      category: other.category,
      sharedDays: edge.sharedDays,
      description: `${other.label}: ${formatSameDayCount(edge.sharedDays)}`,
    });
  }

  items.sort((a, b) => b.sharedDays - a.sharedDays || a.label.localeCompare(b.label));
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

interface RawNodeAccumulator {
  id: string;
  label: string;
  category: ConstellationCategory;
  dates: Set<ISODate>;
}

/**
 * Computes a deterministic, settled 2D star layout seeded solely by node ids
 * and weighted by shared-day edges so the constellation never drifts between renders.
 */
export function computeDeterministicConstellationLayout(
  nodes: readonly Pick<ConstellationNode, "id" | "radius">[],
  edges: readonly Pick<ConstellationEdge, "source" | "target" | "sharedDays">[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const { width, height, padding } = CONSTELLATION_VIEWBOX;
  const cx = width / 2;
  const cy = height / 2;

  interface Body {
    id: string;
    radius: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
  }

  const bodies: Body[] = sortedNodes.map((n, index) => {
    const rng = createMulberry32(hashStringFNV1a(n.id));
    const angle = index * 2.399963229728653 + (rng() - 0.5) * 0.45;
    const ring = Math.sqrt((index + 0.5) / sortedNodes.length);
    const rx = (width / 2 - padding - 20) * (0.28 + 0.65 * ring);
    const ry = (height / 2 - padding - 16) * (0.28 + 0.65 * ring);
    return {
      id: n.id,
      radius: n.radius,
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
      vx: 0,
      vy: 0,
    };
  });

  const indexById = new Map(bodies.map((b, i) => [b.id, i]));
  const maxShared = edges.reduce((acc, e) => Math.max(acc, e.sharedDays), MIN_SHARED_DAYS);
  const ticks = 160;

  for (let tick = 0; tick < ticks; tick += 1) {
    const cooling = 1 - tick / ticks;
    const alpha = 0.25 + 0.75 * cooling;

    // 1. Pairwise repulsion with node-radius clearance
    for (let i = 0; i < bodies.length; i += 1) {
      const a = bodies[i]!;
      for (let j = i + 1; j < bodies.length; j += 1) {
        const b = bodies[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 0.01) {
          dx = 0.1 * ((i % 2 === 0 ? 1 : -1) || 1);
          dy = 0.1 * ((j % 2 === 0 ? -1 : 1) || 1);
          distSq = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(distSq);
        const minDesired = a.radius + b.radius + 54;
        const repulse = 2600 / Math.max(distSq, 144);
        const overlapPush = dist < minDesired ? (minDesired - dist) * 0.22 : 0;
        const force = (repulse + overlapPush) * alpha;
        const nx = dx / dist;
        const ny = dy / dist;

        a.vx -= nx * force;
        a.vy -= ny * force;
        b.vx += nx * force;
        b.vy += ny * force;
      }
    }

    // 2. Co-occurrence spring attraction
    for (const edge of edges) {
      const iA = indexById.get(edge.source);
      const iB = indexById.get(edge.target);
      if (iA === undefined || iB === undefined) continue;
      const a = bodies[iA]!;
      const b = bodies[iB]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const strength = edge.sharedDays / maxShared;
      const targetLen = 195 - strength * 80;
      const pull = (dist - targetLen) * (0.045 + strength * 0.035) * alpha;
      const nx = dx / dist;
      const ny = dy / dist;

      a.vx += nx * pull;
      a.vy += ny * pull;
      b.vx -= nx * pull;
      b.vy -= ny * pull;
    }

    // 3. Gentle centering toward landscape starfield aspect & damping
    for (const body of bodies) {
      body.vx += (cx - body.x) * 0.014 * alpha;
      body.vy += (cy - body.y) * 0.02 * alpha;
      body.vx *= 0.72;
      body.vy *= 0.72;

      body.x = Math.min(width - padding, Math.max(padding, body.x + body.vx));
      body.y = Math.min(height - padding, Math.max(padding, body.y + body.vy));
    }
  }

  for (const body of bodies) {
    positions.set(body.id, {
      x: Math.round(body.x * 100) / 100,
      y: Math.round(body.y * 100) / 100,
    });
  }
  return positions;
}

export function deriveConstellation(input: ConstellationInput): ConstellationData {
  const windowDays: ConstellationWindowDays = input.windowDays ?? 30;
  const end = startOfDay(input.today ?? new Date());
  const datesInWindow: ISODate[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    datesInWindow.push(format(subDays(end, offset), "yyyy-MM-dd"));
  }
  const windowStart = datesInWindow[0] ?? format(end, "yyyy-MM-dd");
  const windowEnd = datesInWindow[datesInWindow.length - 1] ?? format(end, "yyyy-MM-dd");
  const inWindow = new Set(datesInWindow);

  const activeHabits = new Map<string, Habit>();
  for (const h of input.habits) {
    if (!h.archived) activeHabits.set(h.id, h);
  }

  const hasAnyData =
    input.habitLogs.some((l) => l.done && activeHabits.has(l.habitId)) ||
    input.activities.length > 0 ||
    input.focus.length > 0 ||
    input.movement.length > 0 ||
    input.mindfulness.length > 0;

  const accumulators = new Map<string, RawNodeAccumulator>();
  const activeDates = new Set<ISODate>();

  const recordOccurrence = (
    id: string,
    label: string,
    category: ConstellationCategory,
    date: ISODate,
  ) => {
    if (!inWindow.has(date)) return;
    activeDates.add(date);
    let acc = accumulators.get(id);
    if (!acc) {
      acc = { id, label, category, dates: new Set<ISODate>() };
      accumulators.set(id, acc);
    }
    acc.dates.add(date);
  };

  for (const log of input.habitLogs) {
    if (!log.done) continue;
    const habit = activeHabits.get(log.habitId);
    if (!habit) continue;
    recordOccurrence(`habit:${habit.id}`, habit.name, "habit", log.date);
  }

  for (const row of input.activities) {
    recordOccurrence(
      `activity:${row.type}`,
      PERSONAL_ACTIVITY_LABELS[row.type],
      "activity",
      row.date,
    );
  }

  for (const row of input.focus) {
    recordOccurrence(
      `method:${row.method}`,
      LEARNING_METHOD_LABELS[row.method],
      "method",
      row.date,
    );
  }

  for (const row of input.movement) {
    recordOccurrence(
      `movement:${row.type}`,
      MOVEMENT_TYPE_LABELS[row.type],
      "movement",
      row.date,
    );
  }

  for (const row of input.mindfulness) {
    recordOccurrence(
      `mindfulness:${row.type}`,
      MINDFULNESS_TYPE_LABELS[row.type],
      "mindfulness",
      row.date,
    );
  }

  const activeDaysCount = activeDates.size;
  const meetsMinDays = activeDaysCount >= MIN_CONSTELLATION_DAYS;

  if (!meetsMinDays) {
    return {
      windowDays,
      windowStart,
      windowEnd,
      datesInWindow,
      activeDaysCount,
      minDaysRequired: MIN_CONSTELLATION_DAYS,
      meetsMinDays: false,
      hasAnyData,
      nodes: [],
      edges: [],
      summaryText: `Constellation needs at least ${MIN_CONSTELLATION_DAYS} logged days in the ${windowDays}-day window (${activeDaysCount} logged so far).`,
    };
  }

  const rawList = Array.from(accumulators.values()).sort((a, b) => a.id.localeCompare(b.id));
  const maxDaysPresent = rawList.reduce((acc, item) => Math.max(acc, item.dates.size), 1);

  const preliminaryNodes = rawList.map((item) => {
    const daysPresent = item.dates.size;
    const frequencyRatio = daysPresent / maxDaysPresent;
    const radius = Math.round((6.5 + frequencyRatio * 8.5) * 10) / 10;
    const brightness = Math.round((0.48 + frequencyRatio * 0.52) * 100) / 100;
    return {
      item,
      daysPresent,
      frequencyRatio,
      radius,
      brightness,
    };
  });

  const rawEdges: Array<{
    id: string;
    source: string;
    target: string;
    sharedDates: ISODate[];
  }> = [];

  for (let i = 0; i < rawList.length; i += 1) {
    const a = rawList[i]!;
    for (let j = i + 1; j < rawList.length; j += 1) {
      const b = rawList[j]!;
      const sharedDates: ISODate[] = [];
      for (const date of a.dates) {
        if (b.dates.has(date)) sharedDates.push(date);
      }
      if (sharedDates.length >= MIN_SHARED_DAYS) {
        sharedDates.sort();
        rawEdges.push({
          id: `${a.id}--${b.id}`,
          source: a.id,
          target: b.id,
          sharedDates,
        });
      }
    }
  }

  const maxSharedDays = rawEdges.reduce(
    (acc, edge) => Math.max(acc, edge.sharedDates.length),
    MIN_SHARED_DAYS,
  );

  const edges: ConstellationEdge[] = rawEdges
    .map((edge) => {
      const ratio = edge.sharedDates.length / maxSharedDays;
      const thickness = Math.round((1.25 + ratio * 3.25) * 100) / 100;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sharedDays: edge.sharedDates.length,
        sharedDates: edge.sharedDates,
        thickness,
      };
    })
    .sort((a, b) => b.sharedDays - a.sharedDays || a.id.localeCompare(b.id));

  const positions = computeDeterministicConstellationLayout(
    preliminaryNodes.map((n) => ({ id: n.item.id, radius: n.radius })),
    edges,
  );

  const nodes: ConstellationNode[] = preliminaryNodes
    .map(({ item, daysPresent, frequencyRatio, radius, brightness }) => {
      const pos = positions.get(item.id) ?? {
        x: CONSTELLATION_VIEWBOX.width / 2,
        y: CONSTELLATION_VIEWBOX.height / 2,
      };
      return {
        id: item.id,
        label: item.label,
        category: item.category,
        daysPresent,
        dates: Array.from(item.dates).sort(),
        frequencyRatio,
        radius,
        brightness,
        x: pos.x,
        y: pos.y,
        logHref: CATEGORY_LOG_HREF[item.category],
      };
    })
    .sort((a, b) => b.daysPresent - a.daysPresent || a.label.localeCompare(b.label));

  const summaryText = `Constellation across the last ${windowDays} days (${windowStart} to ${windowEnd}): ${nodes.length} stars across ${activeDaysCount} active days, with ${edges.length} same-day connections (${MIN_SHARED_DAYS}+ shared days).`;

  return {
    windowDays,
    windowStart,
    windowEnd,
    datesInWindow,
    activeDaysCount,
    minDaysRequired: MIN_CONSTELLATION_DAYS,
    meetsMinDays: true,
    hasAnyData,
    nodes,
    edges,
    summaryText,
  };
}
