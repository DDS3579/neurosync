import { describe, expect, it } from "vitest";

import { deriveExperimentStatus, experimentFormSchema } from "./experimentUtils";

const WINDOWS = {
  baselineStart: "2026-11-01",
  baselineEnd: "2026-11-07",
  interventionStart: "2026-11-08",
  interventionEnd: "2026-11-14",
};

describe("deriveExperimentStatus", () => {
  it("returns planned before baselineStart", () => {
    expect(deriveExperimentStatus(WINDOWS, "2026-10-31")).toBe("planned");
  });

  it("returns baseline across inclusive baseline dates", () => {
    expect(deriveExperimentStatus(WINDOWS, "2026-11-01")).toBe("baseline");
    expect(deriveExperimentStatus(WINDOWS, "2026-11-04")).toBe("baseline");
    expect(deriveExperimentStatus(WINDOWS, "2026-11-07")).toBe("baseline");
  });

  it("stays in baseline during a gap between baselineEnd and interventionStart", () => {
    const gapped = { ...WINDOWS, interventionStart: "2026-11-10", interventionEnd: "2026-11-16" };
    expect(deriveExperimentStatus(gapped, "2026-11-08")).toBe("baseline");
  });

  it("returns intervention across inclusive intervention dates", () => {
    expect(deriveExperimentStatus(WINDOWS, "2026-11-08")).toBe("intervention");
    expect(deriveExperimentStatus(WINDOWS, "2026-11-11")).toBe("intervention");
    expect(deriveExperimentStatus(WINDOWS, "2026-11-14")).toBe("intervention");
  });

  it("returns complete after interventionEnd", () => {
    expect(deriveExperimentStatus(WINDOWS, "2026-11-15")).toBe("complete");
  });
});

describe("experimentFormSchema", () => {
  it("rejects overlapping baseline and intervention ranges", () => {
    const res = experimentFormSchema.safeParse({
      title: "Steadier bedtime",
      hypothesis: "Consistent bedtime coincides with steadier focus.",
      changeDescription: "Lights out by 23:00",
      metric: "concentration",
      baselineStart: "2026-11-01",
      baselineEnd: "2026-11-08",
      interventionStart: "2026-11-08",
      interventionEnd: "2026-11-14",
    });
    expect(res.success).toBe(false);
  });
});
