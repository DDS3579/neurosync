import { describe, expect, it } from "vitest";

import { ACTIVITY_META } from "@/data/brainRegions";
import { REGION_SLOTS } from "./regionZones";
import {
  compareActivities,
  compareToSlotWeights,
  pickDefaultComparePartner,
} from "./brainCompare";

describe("brainCompare", () => {
  it("computes shared overlap and distinct regions for partially overlapping activities", () => {
    // deep_focus: prefrontal (1.0), parietal (0.7)
    // active_recall: hippocampus (1.0), prefrontal (0.8), temporal (0.5)
    const result = compareActivities("deep_focus", "active_recall");

    expect(result.sameActivity).toBe(false);
    expect(result.sharedRegions.map((r) => r.regionId)).toEqual(["prefrontal"]);
    expect(result.onlyARegions.map((r) => r.regionId)).toEqual(["parietal"]);
    expect(result.onlyBRegions.map((r) => r.regionId)).toEqual(["hippocampus", "temporal"]);

    expect(result.byRegion.prefrontal.status).toBe("both");
    expect(result.byRegion.parietal.status).toBe("onlyA");
    expect(result.byRegion.hippocampus.status).toBe("onlyB");
    expect(result.byRegion.occipital.status).toBe("none");

    expect(result.summary).toContain("Deep focus");
    expect(result.summary).toContain("Active recall");
    expect(result.summary).toContain("Prefrontal Cortex");
    expect(result.summary).toContain("Parietal Lobe");
    expect(result.summary).toContain("Hippocampus");
    expect(result.summary.toLowerCase()).not.toContain("measure");
  });

  it("handles activities with zero regional overlap cleanly", () => {
    // exercise: cerebellum (1.0), parietal (0.6)
    // mindfulness: prefrontal (0.8), amygdala (0.6)
    const result = compareActivities("exercise", "mindfulness");

    expect(result.sharedRegions).toEqual([]);
    expect(result.onlyARegions.map((r) => r.regionId)).toEqual(["cerebellum", "parietal"]);
    expect(result.onlyBRegions.map((r) => r.regionId)).toEqual(["prefrontal", "amygdala"]);
    expect(result.summary).toContain("no overlap");
  });

  it("handles activities that map to the exact same region set with different weights", () => {
    // active_recall and spaced_repetition both map to hippocampus, prefrontal, temporal
    const result = compareActivities("active_recall", "spaced_repetition");

    expect(result.sameActivity).toBe(false);
    expect(result.sharedRegions.map((r) => r.regionId)).toEqual([
      "hippocampus",
      "prefrontal",
      "temporal",
    ]);
    expect(result.onlyARegions).toEqual([]);
    expect(result.onlyBRegions).toEqual([]);
    expect(result.summary).toContain("same set of regions");
  });

  it("handles selecting the exact same activity in both slots", () => {
    const result = compareActivities("sleep_rest", "sleep_rest");

    expect(result.sameActivity).toBe(true);
    expect(result.sharedRegions.map((r) => r.regionId)).toEqual(["hippocampus"]);
    expect(result.onlyARegions).toEqual([]);
    expect(result.onlyBRegions).toEqual([]);
    expect(result.summary).toContain(ACTIVITY_META.sleep_rest.label);
  });

  it("builds fixed-length uniform arrays and detects internal regions", () => {
    const deepPair = compareToSlotWeights("deep_focus", "sleep_rest");
    expect(deepPair.weightsA).toHaveLength(REGION_SLOTS);
    expect(deepPair.weightsB).toHaveLength(REGION_SLOTS);
    expect(deepPair.weightsA[0]).toBe(1.0); // prefrontal
    expect(deepPair.weightsB[5]).toBe(0.9); // hippocampus
    expect(deepPair.weightsA[7]).toBe(0); // unassigned slot
    expect(deepPair.involvesDeep).toBe(true);

    const surfacePair = compareToSlotWeights("deep_focus", "exercise");
    expect(surfacePair.involvesDeep).toBe(false);
  });

  it("picks a distinct comparison partner when jumping from related activities", () => {
    expect(pickDefaultComparePartner("deep_focus", "mindfulness")).toBe("mindfulness");
    expect(pickDefaultComparePartner("mindfulness", "mindfulness")).not.toBe("mindfulness");
    expect(pickDefaultComparePartner("deep_focus")).not.toBe("deep_focus");
  });
});
