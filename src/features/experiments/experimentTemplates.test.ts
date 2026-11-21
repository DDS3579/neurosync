import { describe, expect, it } from "vitest";
import { experimentFormSchema } from "./experimentUtils";
import {
  BLOCK_PLANNING_TEMPLATE,
  EXPERIMENT_TEMPLATES,
  applyExperimentTemplate,
  getExperimentTemplate,
  templateWindows,
} from "./experimentTemplates";

describe("block planning experiment template", () => {
  it("is selectable, uses concentration and sensible 7 + 7 day windows", () => {
    expect(EXPERIMENT_TEMPLATES).toHaveLength(1);
    expect(getExperimentTemplate("block-planning-focus")).toBe(BLOCK_PLANNING_TEMPLATE);
    expect(getExperimentTemplate("nope")).toBeNull();
    expect(BLOCK_PLANNING_TEMPLATE.metric).toBe("concentration");
    expect(BLOCK_PLANNING_TEMPLATE.baselineDays).toBe(7);
    expect(BLOCK_PLANNING_TEMPLATE.interventionDays).toBe(7);
    expect(BLOCK_PLANNING_TEMPLATE.title).toBe(
      "Does planning my day in blocks change how focused I feel?",
    );
  });

  it("produces contiguous non-overlapping windows that pass the form schema", () => {
    const values = applyExperimentTemplate(BLOCK_PLANNING_TEMPLATE, "2026-11-19");
    expect(values).toMatchObject({
      baselineStart: "2026-11-19",
      baselineEnd: "2026-11-25",
      interventionStart: "2026-11-26",
      interventionEnd: "2026-12-02",
      metric: "concentration",
      reflection: "",
    });
    expect(experimentFormSchema.safeParse(values).success).toBe(true);
  });

  it("crosses month, year and DST boundaries without losing a day", () => {
    expect(templateWindows(BLOCK_PLANNING_TEMPLATE, "2026-12-28")).toMatchObject({
      baselineStart: "2026-12-28",
      baselineEnd: "2027-01-03",
      interventionStart: "2027-01-04",
      interventionEnd: "2027-01-10",
    });
    const spring = templateWindows(BLOCK_PLANNING_TEMPLATE, "2026-03-05");
    expect(spring.baselineEnd).toBe("2026-03-11");
    expect(spring.interventionStart).toBe("2026-03-12");
    const fall = templateWindows(BLOCK_PLANNING_TEMPLATE, "2026-10-29");
    expect(fall.baselineEnd).toBe("2026-11-04");
    expect(fall.interventionEnd).toBe("2026-11-11");
  });

  it("keeps the hypothesis and caveat free of causal and scoring language", () => {
    for (const text of [
      BLOCK_PLANNING_TEMPLATE.hypothesis,
      BLOCK_PLANNING_TEMPLATE.summary,
      BLOCK_PLANNING_TEMPLATE.caveat,
    ]) {
      // "does not show that ... caused it" is the honest framing, so only
      // positive causal claims are banned here.
      expect(text).not.toMatch(/\bscore|\bproductivity|\bprove[ns]?\b|\bwill cause\b|\bwill improve\b/i);
    }
    expect(BLOCK_PLANNING_TEMPLATE.caveat).toMatch(/does not show that block planning caused it/i);
  });

  it("honours a gap between windows when a template defines one", () => {
    const gapped = { ...BLOCK_PLANNING_TEMPLATE, gapDays: 2 };
    expect(templateWindows(gapped, "2026-11-19")).toMatchObject({
      baselineEnd: "2026-11-25",
      interventionStart: "2026-11-28",
      interventionEnd: "2026-12-04",
    });
  });
});
