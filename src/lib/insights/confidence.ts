import type { DataConfidenceLevel, InsightConfidence } from '@/types/domain';

export const CONFIDENCE_THRESHOLDS = {
  paired: {
    enoughMinSamples: 14,
    enoughMinEffect: 0.45,
    enoughLargeSample: 21,
    enoughLargeMinEffect: 0.3,
    moderateMinSamples: 8,
    moderateMinEffect: 0.3,
    moderateLargeSample: 12,
  },
  count: {
    enoughMinSamples: 14,
    moderateMinSamples: 7,
  },
} as const;

export interface ConfidenceParams {
  sampleSize: number;
  unit: 'day' | 'night' | 'session' | 'entry';
  paired?: boolean;
  windowDays?: number;
  /** Optional 0..1 normalized effect strength (e.g. |Pearson r| or standardized diff). */
  effectStrength?: number;
}

export function classifyDataConfidence(
  sampleSize: number,
  effectStrength?: number,
): DataConfidenceLevel {
  const n = Math.max(0, Math.floor(sampleSize));
  if (effectStrength !== undefined && Number.isFinite(effectStrength)) {
    const absEff = Math.abs(effectStrength);
    const t = CONFIDENCE_THRESHOLDS.paired;
    if (
      (n >= t.enoughMinSamples && absEff >= t.enoughMinEffect) ||
      (n >= t.enoughLargeSample && absEff >= t.enoughLargeMinEffect)
    ) {
      return 'enough';
    }
    if ((n >= t.moderateMinSamples && absEff >= t.moderateMinEffect) || n >= t.moderateLargeSample) {
      return 'moderate';
    }
    return 'low';
  }

  if (n >= CONFIDENCE_THRESHOLDS.count.enoughMinSamples) return 'enough';
  if (n >= CONFIDENCE_THRESHOLDS.count.moderateMinSamples) return 'moderate';
  return 'low';
}

function pluralizeUnit(unit: ConfidenceParams['unit'], count: number): string {
  if (count === 1) return unit;
  return `${unit}s`;
}

export function buildConfidence(params: ConfidenceParams): InsightConfidence {
  const sampleSize = Math.max(0, Math.floor(params.sampleSize));
  const level = classifyDataConfidence(sampleSize, params.effectStrength);
  const noun = pluralizeUnit(params.unit, sampleSize);

  let summary: string;
  if (params.paired) {
    summary = `Based on ${sampleSize} ${noun} of paired data`;
  } else if (params.windowDays) {
    summary = `Based on ${sampleSize} ${noun} over the last ${params.windowDays} days`;
  } else {
    summary = `Based on ${sampleSize} ${noun}`;
  }

  return { level, summary, sampleSize };
}
