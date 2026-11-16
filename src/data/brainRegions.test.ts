import { describe, expect, it } from 'vitest';
import type { ActivityKind, RegionId } from '@/types/domain';
import {
  ACTIVITY_META,
  ACTIVITY_REGION_MAP,
  BRAIN_REGIONS,
  activityToRegionIntensity,
} from './brainRegions';
import { LIBRARY_ENTRIES } from './library';

// Domain imports are type-only, so these tests run under Vitest with no path-alias config.

const ALL_REGIONS: readonly RegionId[] = [
  'prefrontal', 'parietal', 'temporal', 'occipital', 'cerebellum', 'hippocampus', 'amygdala',
];
const ALL_KINDS: readonly ActivityKind[] = [
  'deep_focus', 'active_recall', 'spaced_repetition', 'problem_solving', 'reading',
  'skill_practice', 'teaching', 'exercise', 'mindfulness', 'social', 'creative',
  'music', 'language_learning', 'sleep_rest',
];

describe('BRAIN_REGIONS', () => {
  it('covers all 7 regions exactly once', () => {
    expect(BRAIN_REGIONS.map((r) => r.id).sort()).toEqual([...ALL_REGIONS].sort());
  });

  it('meets the content shape contract for every region', () => {
    for (const region of BRAIN_REGIONS) {
      expect(region.name.length).toBeGreaterThan(0);
      expect(region.shortDescription.length).toBeGreaterThan(0);
      expect(region.associatedWith.length).toBeGreaterThanOrEqual(4);
      expect(region.associatedWith.length).toBeLessThanOrEqual(6);
      expect(region.networks.length).toBeGreaterThanOrEqual(2);
      expect(region.networks.length).toBeLessThanOrEqual(4);
      expect(region.everydayExamples).toHaveLength(3);
    }
  });

  it('marks hippocampus and amygdala as deep/internal structures', () => {
    for (const id of ['hippocampus', 'amygdala'] as const) {
      const region = BRAIN_REGIONS.find((r) => r.id === id);
      expect(region?.shortDescription).toMatch(/deep|internal/i);
    }
  });

  it('gives every region a caveat stressing simplification and networks', () => {
    for (const region of BRAIN_REGIONS) {
      expect(region.caveat).toMatch(/simplified/i);
      expect(region.caveat).toMatch(/network/i);
    }
  });

  it('uses only valid ids in connectedTo and relatedActivities, never self-links', () => {
    for (const region of BRAIN_REGIONS) {
      for (const id of region.connectedTo) {
        expect(ALL_REGIONS).toContain(id);
        expect(id).not.toBe(region.id);
      }
      for (const kind of region.relatedActivities) expect(ALL_KINDS).toContain(kind);
    }
  });
});

describe('ACTIVITY_META', () => {
  it('covers exactly the 14 ActivityKinds with non-empty label and description', () => {
    expect(Object.keys(ACTIVITY_META).sort()).toEqual([...ALL_KINDS].sort());
    for (const kind of ALL_KINDS) {
      expect(ACTIVITY_META[kind].label.length).toBeGreaterThan(0);
      expect(ACTIVITY_META[kind].description.length).toBeGreaterThan(0);
    }
  });
});

describe('ACTIVITY_REGION_MAP', () => {
  it('has a non-empty mapping for every ActivityKind', () => {
    expect(Object.keys(ACTIVITY_REGION_MAP).sort()).toEqual([...ALL_KINDS].sort());
    for (const kind of ALL_KINDS) expect(ACTIVITY_REGION_MAP[kind].length).toBeGreaterThan(0);
  });

  it('keeps weights within 0..1, regions valid, and no duplicate regions per kind', () => {
    for (const kind of ALL_KINDS) {
      const seen = new Set<RegionId>();
      for (const { region, weight } of ACTIVITY_REGION_MAP[kind]) {
        expect(ALL_REGIONS).toContain(region);
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThanOrEqual(1);
        expect(seen.has(region)).toBe(false);
        seen.add(region);
      }
    }
  });
});

describe('activityToRegionIntensity', () => {
  it('returns {} for no items', () => {
    expect(activityToRegionIntensity([])).toEqual({});
  });

  it('computes known soft-cap values (60 min deep focus)', () => {
    const out = activityToRegionIntensity([{ kind: 'deep_focus', minutes: 60 }]);
    expect(out.prefrontal).toBeCloseTo(0.7769, 3); // 1 - exp(-60/40)
    expect(out.parietal).toBeCloseTo(0.6501, 3); // 1 - exp(-42/40)
    expect(out.temporal).toBeUndefined(); // zeros omitted
  });

  it('approaches ~0.95 at the 120-weighted-minute soft cap without hard-clipping', () => {
    const out = activityToRegionIntensity([{ kind: 'deep_focus', minutes: 120 }]);
    expect(out.prefrontal).toBeCloseTo(0.95, 2);
    expect(out.prefrontal).toBeLessThan(1);
  });

  it('keeps every intensity in 0..1 for a full mixed day covering all regions', () => {
    const out = activityToRegionIntensity(ALL_KINDS.map((kind) => ({ kind, minutes: 300 })));
    expect(Object.keys(out).sort()).toEqual([...ALL_REGIONS].sort());
    for (const value of Object.values(out)) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('never exceeds 1 even for absurd inputs, and shows diminishing returns', () => {
    const absurd = activityToRegionIntensity([{ kind: 'deep_focus', minutes: 1e9 }]);
    expect(absurd.prefrontal).toBeLessThanOrEqual(1);
    expect(absurd.prefrontal).toBeGreaterThanOrEqual(0);
    const at = (m: number) => activityToRegionIntensity([{ kind: 'deep_focus', minutes: m }]).prefrontal ?? 0;
    expect(at(120)).toBeGreaterThan(at(60)); // monotone
    expect(at(240) - at(120)).toBeLessThan(at(120) - at(60)); // saturating
  });

  it('ignores zero, negative and non-finite minutes', () => {
    expect(
      activityToRegionIntensity([
        { kind: 'deep_focus', minutes: 0 },
        { kind: 'deep_focus', minutes: -30 },
        { kind: 'deep_focus', minutes: Number.NaN },
      ]),
    ).toEqual({});
    const clean = activityToRegionIntensity([{ kind: 'reading', minutes: 45 }]);
    const mixed = activityToRegionIntensity([
      { kind: 'reading', minutes: 45 },
      { kind: 'exercise', minutes: -10 },
    ]);
    expect(mixed).toEqual(clean);
  });

  it('is additive across items and independent of input order', () => {
    const single = activityToRegionIntensity([{ kind: 'deep_focus', minutes: 60 }]);
    const split = activityToRegionIntensity([
      { kind: 'deep_focus', minutes: 30 },
      { kind: 'deep_focus', minutes: 30 },
    ]);
    expect(split).toEqual(single);
    const items = [
      { kind: 'reading', minutes: 40 },
      { kind: 'music', minutes: 25 },
      { kind: 'exercise', minutes: 60 },
    ] as const;
    expect(activityToRegionIntensity([...items].reverse())).toEqual(activityToRegionIntensity(items));
  });

  it('does not mutate its input (frozen items work)', () => {
    const frozen = Object.freeze([Object.freeze({ kind: 'music' as const, minutes: 30 })]);
    expect(activityToRegionIntensity(frozen).temporal).toBeGreaterThan(0);
  });
});

describe('content safety', () => {
  const BANNED: readonly RegExp[] = [
    /\bbrain score\b/i, /\bgrew\b/i, /\bboost your iq\b/i, /\bcure[ds]?\b/i, // required by contract
    /\bbrain health\b/i, /\bstrengthen/i, /\bgrow/i, /\bboost/i, /\biq\b/i, // project non-negotiables
    /\bdiagnos/i, /\bdisorder/i, /\bcalorie/i, /\bmacro/i, /\bscore\b/i,
    /\bfail/i, /\bsham(e|ing)\b/i, /\bguilt/i, /\bunhealthy\b/i, /\blazy\b/i, /\boptimiz/i,
  ];

  const allContent: string[] = [
    ...BRAIN_REGIONS.flatMap((r) => [
      r.name, r.shortDescription, r.caveat,
      ...r.associatedWith, ...r.networks, ...r.everydayExamples,
    ]),
    ...Object.values(ACTIVITY_META).flatMap((m) => [m.label, m.description]),
    ...LIBRARY_ENTRIES.flatMap((e) => [e.title, e.summary, e.caveat, ...e.body, ...e.keyPoints]),
  ];

  it('contains no banned phrases anywhere in atlas, activity or library copy', () => {
    for (const text of allContent) {
      for (const pattern of BANNED) expect(text).not.toMatch(pattern);
    }
  });

  it('library has 16–20 well-formed entries, including one per region', () => {
    expect(LIBRARY_ENTRIES.length).toBeGreaterThanOrEqual(16);
    expect(LIBRARY_ENTRIES.length).toBeLessThanOrEqual(20);
    expect(new Set(LIBRARY_ENTRIES.map((e) => e.id)).size).toBe(LIBRARY_ENTRIES.length);
    const regionEntries = LIBRARY_ENTRIES.filter((e) => e.category === 'region');
    expect(regionEntries).toHaveLength(7);
    const covered = new Set(regionEntries.flatMap((e) => e.relatedRegions ?? []));
    for (const id of ALL_REGIONS) expect(covered.has(id)).toBe(true);
    for (const entry of LIBRARY_ENTRIES) {
      expect(entry.body.length).toBeGreaterThanOrEqual(2);
      expect(entry.keyPoints.length).toBeGreaterThanOrEqual(3);
      expect(entry.caveat.length).toBeGreaterThan(0);
      for (const id of entry.relatedRegions ?? []) expect(ALL_REGIONS).toContain(id);
    }
  });
});
